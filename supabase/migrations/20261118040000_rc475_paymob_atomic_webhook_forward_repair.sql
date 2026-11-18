-- RC475: forward-only Production repair for missing Paymob atomic webhook RPCs.
-- RC428–RC430 are historical source migrations older than the live Production ledger.
-- This migration recreates only the missing service-role RPCs after validating the current schema.
DO $preflight$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(format('%s.%s expected %s', r.table_name, r.column_name, r.data_type), ', ')
    INTO v_missing
  FROM (VALUES
    ('payment_intents','id','character varying'),
    ('payment_intents','tenant_id','character varying'),
    ('payment_intents','order_id','uuid'),
    ('payment_intents','amount','numeric'),
    ('payment_intents','currency','character varying'),
    ('payment_intents','status','character varying'),
    ('payment_intents','provider','character varying'),
    ('payment_intents','provider_order_id','text'),
    ('payment_intents','pricing_version','bigint'),
    ('payment_intents','pricing_hash','character varying'),
    ('payment_intents','updated_at','timestamp with time zone'),
    ('orders','id','uuid'),
    ('orders','tenant_id','character varying'),
    ('orders','status','character varying'),
    ('orders','total','numeric'),
    ('orders','currency','character varying'),
    ('orders','pricing_version','bigint'),
    ('orders','pricing_hash','character varying'),
    ('orders','pricing_authority','character varying'),
    ('payment_provider_events','id','character varying'),
    ('payment_provider_events','tenant_id','character varying'),
    ('payment_provider_events','provider','character varying'),
    ('payment_provider_events','event_type','character varying'),
    ('payment_provider_events','payment_intent_id','character varying'),
    ('payment_provider_events','external_event_id','character varying'),
    ('payment_provider_events','status','character varying'),
    ('payment_provider_events','signature_verified','boolean'),
    ('payment_provider_events','raw_payload','jsonb'),
    ('payment_provider_events','processed_at','timestamp with time zone'),
    ('subscription_payment_intents','id','uuid'),
    ('subscription_payment_intents','business_id','uuid'),
    ('subscription_payment_intents','tier_code','text'),
    ('subscription_payment_intents','billing_cycle','text'),
    ('subscription_payment_intents','sector','text'),
    ('subscription_payment_intents','amount','numeric'),
    ('subscription_payment_intents','currency','text'),
    ('subscription_payment_intents','status','text'),
    ('subscription_payment_intents','provider','text'),
    ('subscription_payment_intents','provider_order_id','text'),
    ('subscription_payment_intents','provider_transaction_id','text'),
    ('subscription_payment_intents','created_by','uuid'),
    ('subscription_payment_intents','updated_at','timestamp with time zone'),
    ('businesses','id','uuid'),
    ('businesses','tenant_id','character varying'),
    ('user_memberships','user_id','uuid'),
    ('user_memberships','business_id','uuid'),
    ('user_memberships','status','character varying'),
    ('user_memberships','role','character varying'),
    ('user_memberships','created_at','timestamp with time zone'),
    ('business_subscriptions','business_id','uuid'),
    ('business_subscriptions','tier_code','text'),
    ('business_subscriptions','billing_cycle','text'),
    ('business_subscriptions','status','text'),
    ('business_subscriptions','sector','text'),
    ('business_subscriptions','starts_at','timestamp with time zone'),
    ('business_subscriptions','ends_at','timestamp with time zone'),
    ('business_subscriptions','provider','text'),
    ('business_subscriptions','provider_reference','text'),
    ('business_subscriptions','source_payment_intent_id','uuid'),
    ('business_subscriptions','idempotency_key','text'),
    ('business_subscriptions','created_by','uuid'),
    ('business_subscriptions','updated_at','timestamp with time zone')
  ) AS r(table_name, column_name, data_type)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name
      AND c.column_name = r.column_name
      AND c.data_type = r.data_type
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: %', v_missing;
  END IF;
  IF to_regprocedure('public.legal_assert_action(uuid,text,uuid)') IS NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: legal_assert_action(uuid,text,uuid) is missing';
  END IF;
  IF to_regclass('public.payment_provider_events_provider_external_event_id_key') IS NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: provider event uniqueness is missing';
  END IF;
  IF to_regclass('public.uq_business_subscriptions_idempotency') IS NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: business subscription idempotency uniqueness is missing';
  END IF;
  IF to_regclass('public.uq_subscription_payment_intents_provider_order') IS NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: subscription provider-order uniqueness is missing';
  END IF;

  SELECT string_agg(format('%s.%s expected %s', r.table_name, r.column_name, r.data_type), ', ')
    INTO v_missing
  FROM (VALUES
    ('orders','business_id','uuid'),
    ('orders','assigned_partner_id','uuid'),
    ('orders','payment_method','character varying'),
    ('payment_intents','payment_method','character varying'),
    ('commission_rules','id','character varying'),
    ('commission_rules','tenant_id','character varying'),
    ('commission_rules','business_id','uuid'),
    ('commission_rules','rule_type','character varying'),
    ('commission_rules','percentage','numeric'),
    ('commission_rules','fixed_amount','numeric'),
    ('commission_rules','active','boolean'),
    ('commission_rules','updated_at','timestamp with time zone'),
    ('commission_rules','calculation_mode','text'),
    ('commission_rules','scope_type','text'),
    ('commission_rules','eligibility_event','text'),
    ('commission_rules','rule_priority','integer'),
    ('commission_rules','is_exempt','boolean'),
    ('commission_rules','approval_status','text'),
    ('commission_rules','version_no','integer'),
    ('financial_obligations','id','character varying'),
    ('financial_obligations','tenant_id','character varying'),
    ('financial_obligations','business_id','uuid'),
    ('financial_obligations','order_id','uuid'),
    ('financial_obligations','payment_intent_id','character varying'),
    ('financial_obligations','beneficiary_type','character varying'),
    ('financial_obligations','beneficiary_id','character varying'),
    ('financial_obligations','obligation_type','character varying'),
    ('financial_obligations','gross_amount','numeric'),
    ('financial_obligations','amount','numeric'),
    ('financial_obligations','currency','character varying'),
    ('financial_obligations','status','character varying'),
    ('financial_obligations','payment_method','character varying'),
    ('financial_obligations','settled_at','timestamp with time zone'),
    ('financial_obligations','metadata','jsonb'),
    ('financial_obligations','created_at','timestamp with time zone'),
    ('commission_transactions','id','character varying'),
    ('commission_transactions','tenant_id','character varying'),
    ('commission_transactions','business_id','uuid'),
    ('commission_transactions','order_id','uuid'),
    ('commission_transactions','rule_id','character varying'),
    ('commission_transactions','gross_amount','numeric'),
    ('commission_transactions','commission_amount','numeric'),
    ('commission_transactions','status','character varying'),
    ('payment_financial_reconciliations','id','character varying'),
    ('payment_financial_reconciliations','tenant_id','character varying'),
    ('payment_financial_reconciliations','payment_intent_id','character varying'),
    ('payment_financial_reconciliations','provider_event_id','character varying'),
    ('payment_financial_reconciliations','order_id','uuid'),
    ('payment_financial_reconciliations','currency','character varying'),
    ('payment_financial_reconciliations','gross_amount','numeric'),
    ('payment_financial_reconciliations','commission_amount','numeric'),
    ('payment_financial_reconciliations','provider_received_amount','numeric'),
    ('payment_financial_reconciliations','provider_payout_amount','numeric'),
    ('payment_financial_reconciliations','commission_obligation_id','character varying'),
    ('payment_financial_reconciliations','provider_obligation_id','character varying'),
    ('payment_financial_reconciliations','commission_transaction_id','character varying'),
    ('payment_financial_reconciliations','reconciliation_status','character varying'),
    ('payment_financial_reconciliations','ledger_status','character varying'),
    ('payment_financial_reconciliations','exception_code','character varying'),
    ('payment_financial_reconciliations','metadata','jsonb'),
    ('payment_financial_reconciliations','created_at','timestamp with time zone'),
    ('payment_financial_reconciliations','updated_at','timestamp with time zone')
  ) AS r(table_name, column_name, data_type)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.table_name=r.table_name
      AND c.column_name=r.column_name AND c.data_type=r.data_type
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: %', v_missing;
  END IF;
  IF to_regclass('public.financial_obligations_pkey') IS NULL
     OR to_regclass('public.uq_financial_obligation_idempotent') IS NULL
     OR to_regclass('public.commission_transactions_pkey') IS NULL
     OR to_regclass('public.uq_commission_transactions_order_id') IS NULL
     OR to_regclass('public.payment_financial_reconciliations_pkey') IS NULL
     OR to_regclass('public.uk_payment_financial_reconciliation') IS NULL THEN
    RAISE EXCEPTION 'RC475_SCHEMA_PREFLIGHT_FAILED: financial idempotency indexes are missing';
  END IF;
END;


$preflight$;


-- RC428: atomically persist a verified normal-order Paymob failure event and intent transition.
-- This function definition is forward-repaired in RC475; the historical migration remains unapplied.
create or replace function public.process_verified_provider_payment_failure(
  p_event_id text,
  p_tenant_id text,
  p_provider text,
  p_external_event_id text,
  p_payment_intent_id text,
  p_event_type text,
  p_signature_verified boolean,
  p_provider_confirmed_amount numeric,
  p_provider_confirmed_currency text,
  p_provider_transaction_id text,
  p_provider_order_id text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_intent public.payment_intents%rowtype;
  v_order public.orders%rowtype;
  v_event public.payment_provider_events%rowtype;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'PAYMENT_FAILURE_SIGNATURE_REQUIRED';
  end if;
  if nullif(trim(p_event_id), '') is null
     or nullif(trim(p_external_event_id), '') is null
     or nullif(trim(p_payment_intent_id), '') is null
     or nullif(trim(p_provider_transaction_id), '') is null then
    raise exception 'PAYMENT_FAILURE_EVENT_BINDING_REQUIRED';
  end if;
  if p_external_event_id is distinct from ('paymob:' || p_provider_transaction_id) then
    raise exception 'PAYMENT_FAILURE_TRANSACTION_MISMATCH';
  end if;
  if upper(coalesce(p_provider, '')) <> 'PAYMOB' then
    raise exception 'PAYMENT_FAILURE_PROVIDER_MISMATCH';
  end if;
  if p_provider_confirmed_amount is null or p_provider_confirmed_amount <= 0
     or nullif(trim(p_provider_confirmed_currency), '') is null
     or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'PAYMENT_FAILURE_AMOUNT_CURRENCY_CORRELATION_REQUIRED';
  end if;

  select * into v_intent
  from public.payment_intents
  where id::text = p_payment_intent_id
  for update;
  if not found then
    raise exception 'PAYMENT_INTENT_NOT_FOUND';
  end if;

  select * into v_order
  from public.orders
  where id = v_intent.order_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_intent.tenant_id::text is distinct from p_tenant_id
     or v_order.tenant_id::text is distinct from p_tenant_id
     or upper(v_intent.provider::text) is distinct from upper(p_provider) then
    raise exception 'TENANT_OR_PROVIDER_MISMATCH';
  end if;
  if v_order.status = 'CANCELLED' then
    raise exception 'ORDER_CANCELLED';
  end if;
  if v_intent.provider_order_id is null
     or v_intent.provider_order_id <> p_provider_order_id then
    raise exception 'PAYMENT_PROVIDER_ORDER_MISMATCH';
  end if;
  if v_intent.pricing_hash is null or v_order.pricing_hash is null
     or v_intent.pricing_hash <> v_order.pricing_hash
     or v_intent.pricing_version is distinct from v_order.pricing_version
     or v_order.pricing_authority is null then
    raise exception 'PRICING_BINDING_MISMATCH';
  end if;
  if v_order.total is null
     or v_intent.amount is null
     or abs(v_intent.amount - v_order.total) > 0.01
     or abs(p_provider_confirmed_amount - v_order.total) > 0.01
     or upper(v_intent.currency::text) is distinct from upper(v_order.currency::text)
     or upper(p_provider_confirmed_currency) is distinct from upper(v_order.currency::text) then
    raise exception 'PROVIDER_FINANCIAL_MISMATCH';
  end if;

  select * into v_event
  from public.payment_provider_events
  where provider = p_provider
    and external_event_id = p_external_event_id
  limit 1;
  if found then
    if v_event.payment_intent_id::text is distinct from p_payment_intent_id then
      raise exception 'EXTERNAL_EVENT_REPLAY_MISMATCH';
    end if;
    if upper(v_event.status::text) <> 'FAILED' then
      raise exception 'PAYMENT_FAILURE_REPLAY_STATUS_MISMATCH';
    end if;
    return jsonb_build_object(
      'status', v_intent.status,
      'idempotent', true,
      'already_final', upper(v_intent.status::text) not in ('CREATED', 'PENDING'),
      'payment_intent_id', v_intent.id
    );
  end if;

  insert into public.payment_provider_events(
    id, tenant_id, provider, event_type, payment_intent_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  ) values (
    p_event_id, p_tenant_id, p_provider, coalesce(nullif(p_event_type, ''), 'TRANSACTION'),
    v_intent.id, p_external_event_id, 'FAILED', true, coalesce(p_raw_payload, '{}'::jsonb), now()
  );

  if upper(v_intent.status::text) in ('CREATED', 'PENDING') then
    update public.payment_intents
    set status = 'FAILED', updated_at = now()
    where id::text = p_payment_intent_id
      and upper(status::text) in ('CREATED', 'PENDING');
    if not found then
      raise exception 'PAYMENT_INTENT_STATE_CHANGED';
    end if;
    return jsonb_build_object(
      'status', 'FAILED', 'idempotent', false, 'already_final', false,
      'payment_intent_id', v_intent.id
    );
  end if;

  -- Record the verified failure event, but never downgrade a successful or other final intent.
  return jsonb_build_object(
    'status', v_intent.status, 'idempotent', false, 'already_final', true,
    'payment_intent_id', v_intent.id
  );
end;
$function$;

revoke all on function public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb) from public;
revoke all on function public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb) from anon;
revoke all on function public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb) from authenticated;
grant execute on function public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb) to service_role;

-- RC429: atomically bind and persist failed subscription-payment callbacks.
-- This function definition is forward-repaired in RC475; the historical migration remains unapplied.
create or replace function public.process_verified_subscription_payment_failure(
  p_event_id text,
  p_external_event_id text,
  p_subscription_payment_intent_id uuid,
  p_provider_transaction_id text,
  p_provider_confirmed_amount numeric,
  p_provider_confirmed_currency text,
  p_provider_order_id text,
  p_signature_verified boolean,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_intent public.subscription_payment_intents%rowtype;
  v_existing public.payment_provider_events%rowtype;
  v_tenant_id text;
  v_raw_payload jsonb;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'SUBSCRIPTION_PROVIDER_SIGNATURE_REQUIRED';
  end if;
  if nullif(trim(p_event_id), '') is null
     or nullif(trim(p_external_event_id), '') is null
     or p_subscription_payment_intent_id is null
     or nullif(trim(p_provider_transaction_id), '') is null
     or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'SUBSCRIPTION_PAYMENT_EVENT_BINDING_REQUIRED';
  end if;
  if p_external_event_id is distinct from ('paymob:' || p_provider_transaction_id) then
    raise exception 'SUBSCRIPTION_PAYMENT_TRANSACTION_MISMATCH';
  end if;
  if p_provider_confirmed_amount is null or p_provider_confirmed_amount <= 0
     or nullif(trim(p_provider_confirmed_currency), '') is null then
    raise exception 'SUBSCRIPTION_PAYMENT_AMOUNT_CURRENCY_REQUIRED';
  end if;

  select * into v_intent
  from public.subscription_payment_intents
  where id = p_subscription_payment_intent_id
  for update;
  if not found then
    raise exception 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND';
  end if;
  if upper(v_intent.provider) is distinct from 'PAYMOB'
     or v_intent.provider_order_id is null
     or v_intent.provider_order_id <> p_provider_order_id then
    raise exception 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH';
  end if;
  if v_intent.amount is null
     or abs(v_intent.amount - round(p_provider_confirmed_amount, 2)) > 0.01
     or upper(v_intent.currency) is distinct from upper(p_provider_confirmed_currency) then
    raise exception 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH';
  end if;

  select b.tenant_id::text into v_tenant_id
  from public.businesses b
  where b.id = v_intent.business_id;
  if v_tenant_id is null then
    raise exception 'SUBSCRIPTION_PAYMENT_TENANT_NOT_FOUND';
  end if;

  select * into v_existing
  from public.payment_provider_events
  where provider = 'PAYMOB'
    and external_event_id = p_external_event_id
  limit 1;
  if found then
    if v_existing.event_type is distinct from 'SUBSCRIPTION_FAILURE'
       or v_existing.raw_payload->>'subscription_payment_intent_id' is distinct from p_subscription_payment_intent_id::text
       or v_existing.raw_payload->>'provider_order_id' is distinct from p_provider_order_id
       or v_existing.raw_payload->>'provider_transaction_id' is distinct from p_provider_transaction_id then
      raise exception 'SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH';
    end if;
    return jsonb_build_object(
      'ok', true, 'idempotent', true, 'already_final',
      upper(v_intent.status) not in ('CREATED', 'PENDING'),
      'status', v_intent.status, 'subscription_payment_intent_id', v_intent.id
    );
  end if;

  v_raw_payload := coalesce(p_raw_payload, '{}'::jsonb) || jsonb_build_object(
    'subscription_payment_intent_id', p_subscription_payment_intent_id::text,
    'provider_order_id', p_provider_order_id,
    'provider_transaction_id', p_provider_transaction_id
  );

  insert into public.payment_provider_events(
    id, tenant_id, provider, event_type, payment_intent_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  ) values (
    p_event_id, v_tenant_id, 'PAYMOB', 'SUBSCRIPTION_FAILURE', null,
    p_external_event_id, 'PROCESSED', true, v_raw_payload, now()
  );

  if upper(v_intent.status) in ('CREATED', 'PENDING') then
    update public.subscription_payment_intents
    set status = 'FAILED',
        provider_transaction_id = p_provider_transaction_id,
        updated_at = now()
    where id = v_intent.id
      and upper(status) in ('CREATED', 'PENDING');
    if not found then
      raise exception 'SUBSCRIPTION_PAYMENT_STATE_CHANGED';
    end if;
    return jsonb_build_object(
      'ok', true, 'idempotent', false, 'already_final', false,
      'status', 'FAILED', 'subscription_payment_intent_id', v_intent.id
    );
  end if;

  -- Keep any final/successful state intact; still record the verified failure event.
  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'already_final', true,
    'status', v_intent.status, 'subscription_payment_intent_id', v_intent.id
  );
end;
$function$;

revoke all on function public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb) from public;
revoke all on function public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb) from anon;
revoke all on function public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb) from authenticated;
grant execute on function public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb) to service_role;

-- RC430: harden successful subscription payment processing and replay binding.
-- This function definition is forward-repaired in RC475; the historical migration remains unapplied.
create or replace function public.process_verified_subscription_payment_backend(
  p_event_id text,
  p_external_event_id text,
  p_subscription_payment_intent_id uuid,
  p_provider_transaction_id text,
  p_provider_confirmed_amount numeric,
  p_provider_confirmed_currency text,
  p_provider_order_id text,
  p_signature_verified boolean,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v public.subscription_payment_intents%rowtype;
  v_owner uuid;
  v_sub public.business_subscriptions%rowtype;
  v_existing public.payment_provider_events%rowtype;
  v_tenant_id text;
  v_raw_payload jsonb;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'SUBSCRIPTION_PROVIDER_SIGNATURE_REQUIRED';
  end if;
  if nullif(trim(p_event_id), '') is null
     or nullif(trim(p_external_event_id), '') is null
     or p_subscription_payment_intent_id is null
     or nullif(trim(p_provider_transaction_id), '') is null
     or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'SUBSCRIPTION_PAYMENT_EVENT_BINDING_REQUIRED';
  end if;
  if p_external_event_id is distinct from ('paymob:' || p_provider_transaction_id) then
    raise exception 'SUBSCRIPTION_PAYMENT_TRANSACTION_MISMATCH';
  end if;
  if p_provider_confirmed_amount is null or p_provider_confirmed_amount <= 0
     or nullif(trim(p_provider_confirmed_currency), '') is null then
    raise exception 'SUBSCRIPTION_PAYMENT_AMOUNT_CURRENCY_REQUIRED';
  end if;

  select * into v
  from public.subscription_payment_intents
  where id = p_subscription_payment_intent_id
  for update;
  if not found then
    raise exception 'SUBSCRIPTION_PAYMENT_INTENT_NOT_FOUND';
  end if;
  if upper(v.provider) is distinct from 'PAYMOB'
     or v.provider_order_id is null
     or v.provider_order_id <> p_provider_order_id then
    raise exception 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH';
  end if;
  if v.amount is null
     or abs(v.amount - round(p_provider_confirmed_amount, 2)) > 0.01
     or upper(v.currency) is distinct from upper(p_provider_confirmed_currency) then
    raise exception 'SUBSCRIPTION_PAYMENT_AMOUNT_MISMATCH';
  end if;

  select b.tenant_id::text into v_tenant_id
  from public.businesses b
  where b.id = v.business_id;
  if v_tenant_id is null then
    raise exception 'SUBSCRIPTION_PAYMENT_TENANT_NOT_FOUND';
  end if;

  select * into v_existing
  from public.payment_provider_events
  where provider = 'PAYMOB'
    and external_event_id = p_external_event_id
  limit 1;
  if found then
    if v_existing.event_type is distinct from 'SUBSCRIPTION_SUCCESS'
       or v_existing.raw_payload->>'subscription_payment_intent_id' is distinct from p_subscription_payment_intent_id::text
       or v_existing.raw_payload->>'provider_order_id' is distinct from p_provider_order_id
       or v_existing.raw_payload->>'provider_transaction_id' is distinct from p_provider_transaction_id then
      raise exception 'SUBSCRIPTION_PAYMENT_EVENT_REPLAY_MISMATCH';
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'status', v.status,
      'subscription_payment_intent_id', v.id);
  end if;

  if upper(v.status) not in ('CREATED', 'PENDING') then
    return jsonb_build_object('ok', true, 'idempotent', false, 'already_final', true,
      'status', v.status, 'subscription_payment_intent_id', v.id);
  end if;

  v_raw_payload := coalesce(p_raw_payload, '{}'::jsonb) || jsonb_build_object(
    'subscription_payment_intent_id', p_subscription_payment_intent_id::text,
    'provider_order_id', p_provider_order_id,
    'provider_transaction_id', p_provider_transaction_id
  );
  insert into public.payment_provider_events(
    id, tenant_id, provider, event_type, payment_intent_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  ) values (
    p_event_id, v_tenant_id, 'PAYMOB', 'SUBSCRIPTION_SUCCESS', null,
    p_external_event_id, 'PROCESSED', true, v_raw_payload, now()
  );

  update public.subscription_payment_intents
  set status = 'SUCCEEDED', provider_transaction_id = p_provider_transaction_id, updated_at = now()
  where id = v.id and upper(status) in ('CREATED', 'PENDING');
  if not found then
    raise exception 'SUBSCRIPTION_PAYMENT_STATE_CHANGED';
  end if;

  select m.user_id into v_owner
  from public.user_memberships m
  where m.business_id = v.business_id
    and m.status = 'ACTIVE'
    and upper(m.role) in ('OWNER', 'BUSINESS_OWNER')
  order by m.created_at
  limit 1;

  if v_owner is null then
    update public.subscription_payment_intents
    set status = 'PAID_PENDING_LEGAL', updated_at = now()
    where id = v.id;
    return jsonb_build_object('ok', false, 'status', 'PAID_PENDING_LEGAL',
      'reason', 'OWNER_NOT_FOUND', 'subscription_payment_intent_id', v.id);
  end if;

  begin
    perform public.legal_assert_action(v_owner, 'SUBSCRIPTION_ACTIVATION', v.business_id);
  exception when others then
    update public.subscription_payment_intents
    set status = 'PAID_PENDING_LEGAL', updated_at = now()
    where id = v.id;
    return jsonb_build_object('ok', false, 'status', 'PAID_PENDING_LEGAL',
      'reason', SQLERRM, 'subscription_payment_intent_id', v.id);
  end;

  update public.business_subscriptions
  set status = 'EXPIRED', ends_at = coalesce(ends_at, now()), updated_at = now()
  where business_id = v.business_id and status in ('TRIALING', 'ACTIVE', 'PENDING_PAYMENT');

  insert into public.business_subscriptions(
    business_id, tier_code, billing_cycle, status, sector, starts_at, ends_at,
    provider, provider_reference, source_payment_intent_id, idempotency_key, created_by
  ) values (
    v.business_id, v.tier_code, v.billing_cycle, 'ACTIVE', v.sector, now(),
    case when v.billing_cycle = 'ANNUAL' then now() + interval '1 year' else now() + interval '1 month' end,
    'PAYMOB', v.provider_transaction_id, v.id, 'paid:' || v.id::text, v.created_by
  ) returning * into v_sub;

  return jsonb_build_object('ok', true, 'status', 'ACTIVE',
    'subscription_id', v_sub.id, 'payment_intent_id', v.id);
end;
$function$;

revoke all on function public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb) from public;
revoke all on function public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb) from anon;
revoke all on function public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb) from authenticated;
grant execute on function public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb) to service_role;


-- Harden the existing successful order-payment processor against cross-intent and cross-status event replay.
CREATE OR REPLACE FUNCTION public.process_verified_provider_payment(p_event_id character varying, p_tenant_id character varying, p_provider character varying, p_external_event_id character varying, p_payment_intent_id character varying, p_event_type character varying, p_signature_verified boolean, p_provider_confirmed_amount numeric, p_provider_confirmed_currency character varying, p_platform_received_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_intent record; v_order record; v_commission numeric := 0; v_rule record;
  v_platform_received numeric := greatest(0, coalesce(p_platform_received_amount,0));
  v_existing_event public.payment_provider_events%rowtype;
  v_existing_reconciliation public.payment_financial_reconciliations%rowtype;
  v_commission_tx_id varchar := 'electronic_commission:' || p_payment_intent_id;
  v_reconciliation_id varchar := 'payment_reconciliation:' || p_payment_intent_id;
BEGIN
  IF nullif(btrim(p_event_id), '') IS NULL
     OR nullif(btrim(p_external_event_id), '') IS NULL
     OR nullif(btrim(p_provider), '') IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_EVENT_ID_REQUIRED';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_external_event_id, 0));
  IF coalesce(p_signature_verified, false) IS NOT TRUE THEN RAISE EXCEPTION 'WEBHOOK_SIGNATURE_NOT_VERIFIED'; END IF;
  IF p_provider_confirmed_amount IS NULL OR p_provider_confirmed_amount <= 0 THEN RAISE EXCEPTION 'INVALID_PROVIDER_AMOUNT'; END IF;
  SELECT * INTO v_intent FROM public.payment_intents WHERE id::text=p_payment_intent_id::text FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=v_intent.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_intent.tenant_id::text <> p_tenant_id::text OR v_order.tenant_id::text <> p_tenant_id::text OR v_intent.provider <> p_provider THEN RAISE EXCEPTION 'TENANT_OR_PROVIDER_MISMATCH'; END IF;
  IF v_order.status = 'CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
  IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL OR v_intent.pricing_hash <> v_order.pricing_hash OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version OR v_order.pricing_authority IS NULL THEN RAISE EXCEPTION 'PRICING_BINDING_MISMATCH'; END IF;
  IF v_intent.amount <> v_order.total OR v_intent.currency <> v_order.currency OR p_provider_confirmed_amount <> v_order.total OR p_provider_confirmed_currency <> v_order.currency THEN RAISE EXCEPTION 'PROVIDER_FINANCIAL_MISMATCH'; END IF;
  SELECT * INTO v_existing_event FROM public.payment_provider_events WHERE provider=p_provider AND external_event_id=p_external_event_id LIMIT 1;
  IF FOUND THEN
    IF v_existing_event.payment_intent_id::text IS DISTINCT FROM p_payment_intent_id::text
       OR v_existing_event.tenant_id::text IS DISTINCT FROM p_tenant_id::text
       OR upper(v_existing_event.provider::text) IS DISTINCT FROM upper(p_provider::text)
       OR v_existing_event.event_type::text IS DISTINCT FROM coalesce(nullif(p_event_type::text, ''), 'TRANSACTION')
       OR upper(v_existing_event.status::text) IS DISTINCT FROM 'PROCESSED'
       OR v_existing_event.signature_verified IS NOT TRUE THEN
      RAISE EXCEPTION 'EXTERNAL_EVENT_REPLAY_MISMATCH';
    END IF;
    IF upper(v_intent.status::text) IS DISTINCT FROM 'SUCCEEDED' THEN
      RAISE EXCEPTION 'PAYMENT_INTENT_EVENT_STATE_MISMATCH';
    END IF;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id,'reconciliation_id',v_reconciliation_id);
  END IF;
  IF v_intent.status = 'SUCCEEDED' THEN
    SELECT * INTO v_existing_reconciliation
    FROM public.payment_financial_reconciliations
    WHERE tenant_id=p_tenant_id AND payment_intent_id=p_payment_intent_id
    FOR UPDATE;
    IF FOUND THEN
      v_reconciliation_id := v_existing_reconciliation.id;
    END IF;
    IF NOT FOUND
       OR v_existing_reconciliation.provider_event_id IS DISTINCT FROM p_external_event_id
       OR v_existing_reconciliation.gross_amount IS DISTINCT FROM v_order.total
       OR upper(v_existing_reconciliation.currency::text) IS DISTINCT FROM upper(v_order.currency::text)
       OR upper(v_existing_reconciliation.reconciliation_status::text) IS DISTINCT FROM 'RECONCILED' THEN
      RAISE EXCEPTION 'PAYMENT_INTENT_ALREADY_FINAL_WITHOUT_MATCHING_RECONCILIATION';
    END IF;
    INSERT INTO public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
    VALUES (p_event_id,p_tenant_id,p_provider,coalesce(nullif(p_event_type, ''), 'TRANSACTION'),p_payment_intent_id,p_external_event_id,'PROCESSED',true,'{}'::jsonb,now()) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('status','success','idempotent',true,'payment_intent_id',p_payment_intent_id,'reconciliation_id',v_reconciliation_id);
  END IF;
  IF v_intent.status NOT IN ('CREATED','PENDING') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE: %', v_intent.status; END IF;
  INSERT INTO public.payment_provider_events(id,tenant_id,provider,event_type,payment_intent_id,external_event_id,status,signature_verified,raw_payload,processed_at)
  VALUES (p_event_id,p_tenant_id,p_provider,coalesce(nullif(p_event_type, ''), 'TRANSACTION'),p_payment_intent_id,p_external_event_id,'PROCESSED',true,'{}'::jsonb,now());
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
$function$

REVOKE ALL ON FUNCTION public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) FROM anon;
REVOKE ALL ON FUNCTION public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_provider_payment(character varying,character varying,character varying,character varying,character varying,character varying,boolean,numeric,character varying,numeric) TO service_role;

