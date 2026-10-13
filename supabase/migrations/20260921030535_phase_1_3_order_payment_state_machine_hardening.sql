
CREATE OR REPLACE FUNCTION public.prevent_order_financial_mutation_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment_intents pi
    WHERE pi.order_id = OLD.id
      AND pi.status NOT IN ('CANCELLED','FAILED')
  ) THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.business_id IS DISTINCT FROM OLD.business_id
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.discount IS DISTINCT FROM OLD.discount
       OR NEW.tax IS DISTINCT FROM OLD.tax
       OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
       OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.items_json IS DISTINCT FROM OLD.items_json
       OR NEW.pricing_version IS DISTINCT FROM OLD.pricing_version
       OR NEW.pricing_snapshot IS DISTINCT FROM OLD.pricing_snapshot
       OR NEW.pricing_hash IS DISTINCT FROM OLD.pricing_hash
       OR NEW.pricing_authority IS DISTINCT FROM OLD.pricing_authority
    THEN
      RAISE EXCEPTION 'ORDER_FINANCIAL_FIELDS_LOCKED: authoritative order pricing/customer fields cannot change after payment intent creation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_financial_lock ON public.orders;
CREATE TRIGGER trg_orders_financial_lock
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_order_financial_mutation_after_payment();

CREATE OR REPLACE FUNCTION public.update_order_status_backend(
  p_order_id uuid,
  p_tenant_id character varying,
  p_user_id uuid,
  p_new_status character varying,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders;
  v_role varchar;
  v_membership_business uuid;
  v_is_staff boolean;
  v_scope_ok boolean := false;
  v_allowed boolean := false;
  v_payment_status text;
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AUTH_MISMATCH';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  SELECT upper(m.role), m.business_id
  INTO v_role, v_membership_business
  FROM public.user_memberships m
  WHERE m.user_id=p_user_id AND m.tenant_id=p_tenant_id
    AND coalesce(m.status,'ACTIVE')='ACTIVE'
  ORDER BY CASE WHEN m.business_id=v_order.business_id THEN 0 ELSE 1 END
  LIMIT 1;

  v_is_staff := v_role = ANY(ARRAY['OWNER','ADMIN','MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER']);
  v_scope_ok := v_role = ANY(ARRAY['OWNER','ADMIN'])
    OR (v_role IN ('MANAGER','STAFF','CASHIER','DRIVER','BUSINESS_OWNER')
        AND v_membership_business=v_order.business_id);

  IF v_order.customer_id=p_user_id AND upper(p_new_status)='CANCELLED' THEN
    v_allowed := true;
  END IF;

  IF v_is_staff AND v_scope_ok THEN
    v_allowed := CASE
      WHEN v_order.status IN ('PENDING','CREATED') AND upper(p_new_status) IN ('CONFIRMED','CANCELLED') THEN true
      WHEN v_order.status='CONFIRMED' AND upper(p_new_status) IN ('PREPARING','CANCELLED') THEN true
      WHEN v_order.status='PREPARING' AND upper(p_new_status) IN ('OUT_FOR_DELIVERY','CANCELLED') THEN true
      WHEN v_order.status='OUT_FOR_DELIVERY' AND upper(p_new_status)='DELIVERED' THEN true
      ELSE false
    END;
  END IF;

  IF NOT v_allowed THEN RAISE EXCEPTION 'INVALID_ORDER_TRANSITION'; END IF;

  IF upper(p_new_status)='CANCELLED' THEN
    SELECT pi.status INTO v_payment_status
    FROM public.payment_intents pi
    WHERE pi.order_id=v_order.id
      AND pi.status NOT IN ('CANCELLED','FAILED')
    ORDER BY pi.created_at DESC
    LIMIT 1;

    IF v_payment_status = 'SUCCEEDED' THEN
      RAISE EXCEPTION 'ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION';
    END IF;
  END IF;

  UPDATE public.orders
  SET status=upper(p_new_status),
      notes=coalesce(p_reason,notes),
      updated_at=now()
  WHERE id=p_order_id;

  RETURN jsonb_build_object('id',p_order_id,'status',upper(p_new_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.process_verified_provider_payment(
  p_event_id character varying,
  p_tenant_id character varying,
  p_provider character varying,
  p_external_event_id character varying,
  p_payment_intent_id character varying,
  p_event_type character varying,
  p_signature_verified boolean,
  p_provider_confirmed_amount numeric,
  p_provider_confirmed_currency character varying,
  p_platform_received_amount numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intent record;
  v_order record;
  v_commission numeric := 0;
  v_rule record;
  v_platform_received numeric := greatest(0, coalesce(p_platform_received_amount,0));
  v_existing_event public.payment_provider_events%rowtype;
BEGIN
  IF NOT p_signature_verified THEN RAISE EXCEPTION 'WEBHOOK_SIGNATURE_NOT_VERIFIED'; END IF;
  IF p_provider_confirmed_amount IS NULL OR p_provider_confirmed_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_AMOUNT';
  END IF;

  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE id=p_payment_intent_id::uuid
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=v_intent.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  IF v_intent.tenant_id::text <> p_tenant_id::text OR v_order.tenant_id::text <> p_tenant_id::text
     OR v_intent.provider <> p_provider THEN
    RAISE EXCEPTION 'TENANT_OR_PROVIDER_MISMATCH';
  END IF;

  IF v_order.status = 'CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;

  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL
     OR v_intent.pricing_hash <> v_order.pricing_hash
     OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version
     OR v_order.pricing_authority IS NULL THEN
    RAISE EXCEPTION 'PRICING_BINDING_MISMATCH';
  END IF;

  IF v_intent.amount <> v_order.total
     OR v_intent.currency <> v_order.currency
     OR p_provider_confirmed_amount <> v_order.total
     OR p_provider_confirmed_currency <> v_order.currency THEN
    RAISE EXCEPTION 'PROVIDER_FINANCIAL_MISMATCH';
  END IF;

  SELECT * INTO v_existing_event
  FROM public.payment_provider_events
  WHERE provider=p_provider AND external_event_id=p_external_event_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_event.payment_intent_id::text <> p_payment_intent_id::text THEN
      RAISE EXCEPTION 'EXTERNAL_EVENT_REPLAY_MISMATCH';
    END IF;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id);
  END IF;

  IF v_intent.status = 'SUCCEEDED' THEN
    INSERT INTO public.payment_provider_events(
      id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at
    ) VALUES (
      p_event_id,p_tenant_id,p_provider,p_event_type,p_payment_intent_id,p_external_event_id,
      'PROCESSED',true,'{}'::jsonb,now()
    );
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id);
  END IF;

  IF v_intent.status NOT IN ('CREATED','PENDING') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATE: %', v_intent.status;
  END IF;

  INSERT INTO public.payment_provider_events(
    id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at
  ) VALUES (
    p_event_id,p_tenant_id,p_provider,p_event_type,p_payment_intent_id,p_external_event_id,
    'PROCESSED',true,'{}'::jsonb,now()
  );

  SELECT cr.id,cr.rule_type,cr.percentage,cr.fixed_amount
  INTO v_rule
  FROM public.commission_rules cr
  WHERE cr.tenant_id=p_tenant_id AND cr.active=true
    AND (cr.business_id=v_order.business_id OR cr.business_id IS NULL)
  ORDER BY CASE WHEN cr.business_id=v_order.business_id THEN 0 ELSE 1 END, cr.updated_at DESC
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'COMMISSION_RULE_NOT_CONFIGURED'; END IF;

  IF upper(coalesce(v_rule.rule_type,'PERCENTAGE'))='PERCENTAGE' THEN
    v_commission := round(v_intent.amount*coalesce(v_rule.percentage,0)/100,2);
  ELSIF upper(v_rule.rule_type)='FIXED' THEN
    v_commission := greatest(0,coalesce(v_rule.fixed_amount,0));
  ELSE
    RAISE EXCEPTION 'COMMISSION_RULE_TYPE_UNSUPPORTED';
  END IF;
  IF v_commission > v_intent.amount THEN RAISE EXCEPTION 'COMMISSION_EXCEEDS_ORDER'; END IF;

  UPDATE public.payment_intents
  SET status='SUCCEEDED', updated_at=now()
  WHERE id=v_intent.id;

  v_platform_received := greatest(0,least(v_platform_received,v_commission));

  INSERT INTO public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,settled_at,metadata
  ) VALUES (
    'electronic_commission:'||v_intent.id::text,p_tenant_id,v_order.business_id,v_order.id,v_intent.id::text,
    'PLATFORM','PLATFORM','PLATFORM_COMMISSION',v_intent.amount,v_commission,v_intent.currency,
    CASE WHEN v_platform_received>=v_commission THEN 'SETTLED' ELSE 'DUE' END,
    v_intent.payment_method,
    CASE WHEN v_platform_received>=v_commission THEN now() ELSE NULL END,
    jsonb_build_object('settlement_mode','PROVIDER_CONFIRMED','provider',p_provider,
      'provider_event_id',p_external_event_id,'platform_received_amount',v_platform_received,'commission_rule_id',v_rule.id)
  )
  ON CONFLICT(id) DO UPDATE SET status=excluded.status,settled_at=excluded.settled_at,metadata=excluded.metadata;

  INSERT INTO public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) VALUES (
    'electronic_provider:'||v_intent.id::text,p_tenant_id,v_order.business_id,v_order.id,v_intent.id::text,
    'PROVIDER',coalesce(v_order.assigned_partner_id::text,v_order.business_id::text),
    'PROVIDER_PAYOUT',v_intent.amount,v_intent.amount-v_commission,v_intent.currency,'DUE',
    v_intent.payment_method,jsonb_build_object('settlement_mode','PROVIDER_CONFIRMED','provider',p_provider,'provider_event_id',p_external_event_id)
  ) ON CONFLICT(id) DO NOTHING;

  RETURN jsonb_build_object('status','success','idempotent',false,'payment_intent_id',v_intent.id,
    'gross_amount',v_intent.amount,'commission_amount',v_commission,'platform_received_amount',v_platform_received,
    'platform_commission_status',CASE WHEN v_platform_received>=v_commission THEN 'SETTLED' ELSE 'DUE' END,
    'provider_payout_status','DUE');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_refund_backend(
  p_id character varying,p_tenant_id character varying,p_business_id uuid,p_order_id uuid,
  p_payment_intent_id character varying,p_customer_wallet_id character varying,p_original_amount numeric,
  p_refund_amount numeric,p_reason text,p_idempotency_key character varying,p_journal_entry jsonb,p_journal_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_existing public.refund_transactions%rowtype;
  v_intent public.payment_intents%rowtype;
  v_order public.orders%rowtype;
  v_refunded numeric:=0;
  v_commission numeric:=0;
  v_comm public.commission_transactions%rowtype;
  v_journal_id varchar;
  v_wallet public.wallet_accounts%rowtype;
  v_wallet_balance numeric:=0;
  v_wallet_after numeric;
  v_wallet_tx_id varchar;
BEGIN
  perform public.assert_financial_membership(p_tenant_id);
  IF p_original_amount<=0 OR p_refund_amount<=0 OR p_refund_amount>p_original_amount THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_INVALID';
  END IF;

  IF p_payment_intent_id IS NULL THEN RAISE EXCEPTION 'PAYMENT_INTENT_REQUIRED'; END IF;
  SELECT * INTO v_intent FROM public.payment_intents WHERE id=p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.tenant_id<>p_tenant_id THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
  IF v_intent.status NOT IN ('SUCCEEDED','PARTIALLY_REFUNDED') THEN
    RAISE EXCEPTION 'REFUND_REQUIRES_SUCCEEDED_PAYMENT';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.tenant_id<>p_tenant_id OR v_intent.order_id<>p_order_id THEN
    RAISE EXCEPTION 'ORDER_PAYMENT_MISMATCH';
  END IF;
  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL
     OR v_intent.pricing_hash<>v_order.pricing_hash
     OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version THEN
    RAISE EXCEPTION 'PRICING_BINDING_MISMATCH';
  END IF;

  IF v_intent.amount<>p_original_amount OR p_refund_amount>v_intent.amount THEN
    RAISE EXCEPTION 'REFUND_AMOUNT_MISMATCH';
  END IF;

  SELECT * INTO v_existing FROM public.refund_transactions WHERE idempotency_key=p_idempotency_key LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id',v_existing.id,'status',v_existing.status,'refund_amount',v_existing.refund_amount,
      'commission_reversed',v_existing.commission_reversed,'journal_entry_id',v_existing.journal_entry_id,'idempotent',true);
  END IF;

  SELECT coalesce(sum(refund_amount),0) INTO v_refunded
  FROM public.refund_transactions
  WHERE tenant_id=p_tenant_id AND order_id=p_order_id AND status='CONFIRMED';
  IF p_refund_amount>(p_original_amount-v_refunded) THEN RAISE EXCEPTION 'REFUND_EXCEEDS_REMAINING'; END IF;

  SELECT * INTO v_comm FROM public.commission_transactions WHERE tenant_id=p_tenant_id AND order_id=p_order_id LIMIT 1;
  IF FOUND THEN v_commission:=round(case when v_comm.gross_amount>0 then p_refund_amount*v_comm.commission_amount/v_comm.gross_amount else 0 end,2); END IF;

  v_journal_id:=p_journal_entry->>'id';
  IF coalesce(v_journal_id,'')='' THEN RAISE EXCEPTION 'JOURNAL_ID_REQUIRED'; END IF;

  IF p_customer_wallet_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.wallet_accounts WHERE id=p_customer_wallet_id AND tenant_id=p_tenant_id FOR UPDATE;
    IF NOT FOUND OR v_wallet.status<>'ACTIVE' THEN RAISE EXCEPTION 'WALLET_NOT_ACTIVE'; END IF;
    SELECT coalesce(sum(case when transaction_type in ('CREDIT','REFUND') then amount when transaction_type in ('DEBIT','COMMISSION_SETTLEMENT') then -amount else 0 end),0)
    INTO v_wallet_balance FROM public.wallet_transactions WHERE wallet_id=p_customer_wallet_id AND status='CONFIRMED';
    v_wallet_after:=v_wallet_balance+p_refund_amount;
    v_wallet_tx_id:='wtx_'||substr(md5(p_idempotency_key||':wallet'),1,16);
  END IF;

  perform public.post_financial_journal(p_journal_entry,p_journal_lines);

  INSERT INTO public.refund_transactions(
    id,tenant_id,business_id,order_id,payment_intent_id,refund_amount,commission_reversed,reason,status,idempotency_key,journal_entry_id
  ) VALUES (
    p_id,p_tenant_id,p_business_id,p_order_id,p_payment_intent_id,p_refund_amount,v_commission,p_reason,'CONFIRMED',
    p_idempotency_key,v_journal_id
  );

  IF p_customer_wallet_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions(
      id,tenant_id,wallet_id,transaction_type,amount,balance_after,idempotency_key,status,reference_type,reference_id,description,journal_entry_id
    ) VALUES (
      v_wallet_tx_id,p_tenant_id,p_customer_wallet_id,'REFUND',p_refund_amount,v_wallet_after,p_idempotency_key||':wallet',
      'CONFIRMED','ORDER_REFUND',p_order_id,'استرجاع مبلغ الطلب '||p_order_id,v_journal_id
    );
  END IF;

  UPDATE public.payment_intents pi
  SET updated_at=now(),
      status=case when pi.amount<=coalesce((select sum(r.refund_amount) from public.refund_transactions r where r.payment_intent_id=p_payment_intent_id and r.status='CONFIRMED'),0)
             then 'REFUNDED' else 'PARTIALLY_REFUNDED' end
  WHERE pi.id=p_payment_intent_id;

  IF v_comm.id IS NOT NULL THEN
    UPDATE public.commission_transactions
    SET status=case when commission_amount<=coalesce((select sum(r.commission_reversed) from public.refund_transactions r where r.tenant_id=p_tenant_id and r.order_id=p_order_id and r.status='CONFIRMED'),0)
                    then 'REFUNDED' else status end
    WHERE id=v_comm.id;
  END IF;

  RETURN jsonb_build_object('id',p_id,'status','CONFIRMED','refund_amount',p_refund_amount,
    'commission_reversed',v_commission,'journal_entry_id',v_journal_id,'idempotent',false);
END;
$$;

REVOKE ALL ON FUNCTION public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) TO service_role;

REVOKE ALL ON FUNCTION public.record_refund_backend(character varying,character varying,uuid,uuid,character varying,character varying,numeric,numeric,text,character varying,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_refund_backend(character varying,character varying,uuid,uuid,character varying,character varying,numeric,numeric,text,character varying,jsonb,jsonb) TO service_role;
