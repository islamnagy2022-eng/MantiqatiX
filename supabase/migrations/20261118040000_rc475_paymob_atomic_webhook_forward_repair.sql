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
END;
$preflight$;


-- RC428: atomically persist a verified normal-order Paymob failure event and intent transition.
-- Source-only until reviewed and applied through the approved migration pipeline.
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
-- Source-only until reviewed and applied through the approved migration pipeline.
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
-- Source-only until reviewed and applied through the approved migration pipeline.
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

