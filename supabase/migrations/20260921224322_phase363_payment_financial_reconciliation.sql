-- PHASE 3.63
CREATE TABLE IF NOT EXISTS public.payment_financial_reconciliations (
  id varchar(128) primary key,
  tenant_id varchar(64) not null,
  payment_intent_id varchar(128) not null,
  provider_event_id varchar(128),
  order_id uuid not null,
  currency varchar(16) not null,
  gross_amount numeric(14,4) not null check (gross_amount > 0),
  commission_amount numeric(14,4) not null check (commission_amount >= 0),
  provider_received_amount numeric(14,4) not null check (provider_received_amount >= 0),
  provider_payout_amount numeric(14,4) not null check (provider_payout_amount >= 0),
  commission_obligation_id varchar(128),
  provider_obligation_id varchar(128),
  commission_transaction_id varchar(128),
  reconciliation_status varchar(32) not null default 'RECONCILED' check (reconciliation_status in ('RECONCILED','EXCEPTION')),
  ledger_status varchar(32) not null default 'NOT_POSTED' check (ledger_status in ('NOT_POSTED','POSTED','EXCEPTION')),
  exception_code varchar(128),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uk_payment_financial_reconciliation unique (tenant_id, payment_intent_id)
);
create index if not exists idx_pfr_tenant_status on public.payment_financial_reconciliations(tenant_id, reconciliation_status, created_at desc);
create index if not exists idx_pfr_payment_intent on public.payment_financial_reconciliations(payment_intent_id);
alter table public.payment_financial_reconciliations enable row level security;
alter table public.payment_financial_reconciliations force row level security;
drop policy if exists payment_financial_reconciliations_authenticated_select on public.payment_financial_reconciliations;
create policy payment_financial_reconciliations_authenticated_select on public.payment_financial_reconciliations for select to authenticated using (auth.uid() is not null);
revoke insert, update, delete on public.payment_financial_reconciliations from anon, authenticated;
grant select on public.payment_financial_reconciliations to authenticated;
revoke all on public.payment_financial_reconciliations from public;

CREATE OR REPLACE FUNCTION public.process_verified_provider_payment(
  p_event_id varchar,p_tenant_id varchar,p_provider varchar,p_external_event_id varchar,
  p_payment_intent_id varchar,p_event_type varchar,p_signature_verified boolean,
  p_provider_confirmed_amount numeric,p_provider_confirmed_currency varchar,
  p_platform_received_amount numeric default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_intent record; v_order record; v_commission numeric := 0; v_rule record;
  v_platform_received numeric := greatest(0, coalesce(p_platform_received_amount,0));
  v_existing_event public.payment_provider_events%rowtype;
  v_commission_tx_id varchar := 'electronic_commission:' || p_payment_intent_id;
  v_reconciliation_id varchar := 'payment_reconciliation:' || p_payment_intent_id;
BEGIN
  IF NOT p_signature_verified THEN RAISE EXCEPTION 'WEBHOOK_SIGNATURE_NOT_VERIFIED'; END IF;
  IF p_provider_confirmed_amount IS NULL OR p_provider_confirmed_amount <= 0 THEN RAISE EXCEPTION 'INVALID_PROVIDER_AMOUNT'; END IF;
  SELECT * INTO v_intent FROM public.payment_intents WHERE id=p_payment_intent_id::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=v_intent.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_intent.tenant_id::text <> p_tenant_id::text OR v_order.tenant_id::text <> p_tenant_id::text OR v_intent.provider <> p_provider THEN RAISE EXCEPTION 'TENANT_OR_PROVIDER_MISMATCH'; END IF;
  IF v_order.status = 'CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL OR v_intent.pricing_hash <> v_order.pricing_hash OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version OR v_order.pricing_authority IS NULL THEN RAISE EXCEPTION 'PRICING_BINDING_MISMATCH'; END IF;
  IF v_intent.amount <> v_order.total OR v_intent.currency <> v_order.currency OR p_provider_confirmed_amount <> v_order.total OR p_provider_confirmed_currency <> v_order.currency THEN RAISE EXCEPTION 'PROVIDER_FINANCIAL_MISMATCH'; END IF;
  SELECT * INTO v_existing_event FROM public.payment_provider_events WHERE provider=p_provider AND external_event_id=p_external_event_id LIMIT 1;
  IF FOUND THEN
    IF v_existing_event.payment_intent_id::text <> p_payment_intent_id::text THEN RAISE EXCEPTION 'EXTERNAL_EVENT_REPLAY_MISMATCH'; END IF;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id,'reconciliation_id',v_reconciliation_id);
  END IF;
  IF v_intent.status = 'SUCCEEDED' THEN
    INSERT INTO public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
    VALUES (p_event_id,p_tenant_id,p_provider,p_event_type,p_payment_intent_id,p_external_event_id,'PROCESSED',true,'{}'::jsonb,now()) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id,'reconciliation_id',v_reconciliation_id);
  END IF;
  IF v_intent.status NOT IN ('CREATED','PENDING') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE: %', v_intent.status; END IF;
  INSERT INTO public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
  VALUES (p_event_id,p_tenant_id,p_provider,p_event_type,p_payment_intent_id,p_external_event_id,'PROCESSED',true,'{}'::jsonb,now());
  SELECT cr.id,cr.rule_type,cr.percentage,cr.fixed_amount INTO v_rule
  FROM public.commission_rules cr
  WHERE cr.tenant_id=p_tenant_id AND cr.active=true AND (cr.business_id=v_order.business_id OR cr.business_id IS NULL)
  ORDER BY CASE WHEN cr.business_id=v_order.business_id THEN 0 ELSE 1 END, cr.updated_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMISSION_RULE_NOT_CONFIGURED'; END IF;
  IF upper(coalesce(v_rule.rule_type,'PERCENTAGE'))='PERCENTAGE' THEN
    v_commission := round(v_intent.amount*coalesce(v_rule.percentage,0)/100,2);
  ELSIF upper(v_rule.rule_type) IN ('FIXED','FIXED_PER_ORDER') THEN
    v_commission := greatest(0,coalesce(v_rule.fixed_amount,0));
  ELSE RAISE EXCEPTION 'COMMISSION_RULE_TYPE_UNSUPPORTED'; END IF;
  IF v_commission > v_intent.amount THEN RAISE EXCEPTION 'COMMISSION_EXCEEDS_ORDER'; END IF;
  UPDATE public.payment_intents SET status='SUCCEEDED',updated_at=now() WHERE id=v_intent.id;
  v_platform_received := greatest(0,least(v_platform_received,v_commission));
  INSERT INTO public.financial_obligations(id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,obligation_type,gross_amount,amount,currency,status,payment_method,settled_at,metadata)
  VALUES ('electronic_commission:'||v_intent.id::text,p_tenant_id,v_order.business_id,v_order.id,v_intent.id::text,'PLATFORM','PLATFORM','PLATFORM_COMMISSION',v_intent.amount,v_commission,v_intent.currency,CASE WHEN v_platform_received>=v_commission THEN 'SETTLED' ELSE 'DUE' END,v_intent.payment_method,CASE WHEN v_platform_received>=v_commission THEN now() ELSE NULL END,jsonb_build_object('settlement_mode','PROVIDER_CONFIRMED','provider',p_provider,'provider_event_id',p_external_event_id,'platform_received_amount',v_platform_received,'commission_rule_id',v_rule.id))
  ON CONFLICT(id) DO UPDATE SET status=excluded.status,settled_at=excluded.settled_at,metadata=excluded.metadata;
  INSERT INTO public.financial_obligations(id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,obligation_type,gross_amount,amount,currency,status,payment_method,metadata)
  VALUES ('electronic_provider:'||v_intent.id::text,p_tenant_id,v_order.business_id,v_order.id,v_intent.id::text,'PROVIDER',coalesce(v_order.assigned_partner_id::text,v_order.business_id::text),'PROVIDER_PAYOUT',v_intent.amount,v_intent.amount-v_commission,v_intent.currency,'DUE',v_intent.payment_method,jsonb_build_object('settlement_mode','PROVIDER_CONFIRMED','provider',p_provider,'provider_event_id',p_external_event_id))
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.commission_transactions(id,tenant_id,business_id,order_id,rule_id,gross_amount,commission_amount,status)
  VALUES (v_commission_tx_id,p_tenant_id,v_order.business_id,v_order.id,v_rule.id,v_intent.amount,v_commission,'POSTED')
  ON CONFLICT(id) DO UPDATE SET gross_amount=excluded.gross_amount,commission_amount=excluded.commission_amount,rule_id=excluded.rule_id,status='POSTED';
  INSERT INTO public.payment_financial_reconciliations(id,tenant_id,payment_intent_id,provider_event_id,order_id,currency,gross_amount,commission_amount,provider_received_amount,provider_payout_amount,commission_obligation_id,provider_obligation_id,commission_transaction_id,reconciliation_status,ledger_status,metadata,updated_at)
  VALUES (v_reconciliation_id,p_tenant_id,p_payment_intent_id,p_external_event_id,v_order.id,v_intent.currency,v_intent.amount,v_commission,v_platform_received,v_intent.amount-v_commission,'electronic_commission:'||v_intent.id::text,'electronic_provider:'||v_intent.id::text,v_commission_tx_id,'RECONCILED','NOT_POSTED',jsonb_build_object('provider',p_provider,'provider_event_id',p_external_event_id,'ledger_note','Operational reconciliation complete; GL posting remains explicitly unposted until account mapping is configured'),now())
  ON CONFLICT(tenant_id,payment_intent_id) DO UPDATE SET provider_event_id=excluded.provider_event_id,gross_amount=excluded.gross_amount,commission_amount=excluded.commission_amount,provider_received_amount=excluded.provider_received_amount,provider_payout_amount=excluded.provider_payout_amount,commission_obligation_id=excluded.commission_obligation_id,provider_obligation_id=excluded.provider_obligation_id,commission_transaction_id=excluded.commission_transaction_id,reconciliation_status='RECONCILED',exception_code=null,updated_at=now();
  RETURN jsonb_build_object('status','success','idempotent',false,'payment_intent_id',v_intent.id,'gross_amount',v_intent.amount,'commission_amount',v_commission,'platform_received_amount',v_platform_received,'platform_commission_status',CASE WHEN v_platform_received>=v_commission THEN 'SETTLED' ELSE 'DUE' END,'provider_payout_status','DUE','reconciliation_status','RECONCILED','ledger_status','NOT_POSTED');
END;
$function$;
revoke all on function public.process_verified_provider_payment(varchar,varchar,varchar,varchar,varchar,varchar,boolean,numeric,varchar,numeric) from public,anon,authenticated;
grant execute on function public.process_verified_provider_payment(varchar,varchar,varchar,varchar,varchar,varchar,boolean,numeric,varchar,numeric) to service_role;

CREATE OR REPLACE FUNCTION public.payment_financial_reconciliation_check(p_tenant_id varchar default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_succeeded bigint; v_reconciled bigint; v_missing bigint; v_exception bigint;
BEGIN
  IF p_tenant_id IS NULL AND auth.role() <> 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED'; END IF;
  SELECT count(*) INTO v_succeeded FROM public.payment_intents pi WHERE pi.status='SUCCEEDED' AND (p_tenant_id IS NULL OR pi.tenant_id=p_tenant_id);
  SELECT count(*) INTO v_reconciled FROM public.payment_financial_reconciliations r WHERE r.reconciliation_status='RECONCILED' AND (p_tenant_id IS NULL OR r.tenant_id=p_tenant_id);
  SELECT count(*) INTO v_missing FROM public.payment_intents pi LEFT JOIN public.payment_financial_reconciliations r ON r.tenant_id=pi.tenant_id AND r.payment_intent_id=pi.id WHERE pi.status='SUCCEEDED' AND r.id IS NULL AND (p_tenant_id IS NULL OR pi.tenant_id=p_tenant_id);
  SELECT count(*) INTO v_exception FROM public.payment_financial_reconciliations r WHERE r.reconciliation_status='EXCEPTION' AND (p_tenant_id IS NULL OR r.tenant_id=p_tenant_id);
  RETURN jsonb_build_object('status',CASE WHEN v_missing=0 AND v_exception=0 THEN 'PASS' ELSE 'EXCEPTION' END,'succeeded_payments',v_succeeded,'reconciled_payments',v_reconciled,'missing_reconciliation',v_missing,'reconciliation_exceptions',v_exception);
END;
$function$;
revoke all on function public.payment_financial_reconciliation_check(varchar) from public,anon,authenticated;
grant execute on function public.payment_financial_reconciliation_check(varchar) to service_role;
