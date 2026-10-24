-- RC459: exact-cent enforcement at the authoritative Paymob payment RPC boundary.
-- Forward-only hardening: historical RC425-RC431 migration files are intentionally unchanged.
-- All Paymob webhook amount values are derived from provider integer cents; compare numeric amounts
-- exactly and reject any fractional-cent value rather than tolerating a one-cent discrepancy.
create or replace function public.process_verified_mantigo_payment_backend(
  p_ledger_id text,
  p_external_event_id text,
  p_status text,
  p_signature_verified boolean,
  p_amount numeric,
  p_currency text,
  p_provider_transaction_id text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ledger public.mantigo_financial_ledger%rowtype;
  v_event public.mantigo_payment_provider_events%rowtype;
  v_inserted_id text;
  v_payload_amount numeric;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'MANTIGO_PAYMENT_SIGNATURE_REQUIRED';
  end if;
  if nullif(trim(p_external_event_id), '') is null then
    raise exception 'MANTIGO_PAYMENT_EVENT_ID_REQUIRED';
  end if;
  if nullif(trim(p_provider_transaction_id), '') is null then
    raise exception 'MANTIGO_PAYMENT_TRANSACTION_ID_REQUIRED';
  end if;
  if p_external_event_id <> ('paymob:' || p_provider_transaction_id) then
    raise exception 'MANTIGO_PAYMENT_EVENT_TRANSACTION_MISMATCH';
  end if;
  if p_status is null or p_status not in ('PAID', 'FAILED') then
    raise exception 'MANTIGO_PAYMENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0 or nullif(trim(p_currency), '') is null then
    raise exception 'MANTIGO_PAYMENT_AMOUNT_CURRENCY_INVALID';
  end if;
  if p_raw_payload is null
     or p_raw_payload->>'provider' is distinct from 'PAYMOB'
     or p_raw_payload->>'transaction_id' is distinct from p_provider_transaction_id
     or p_raw_payload->>'merchant_order_id' is distinct from p_ledger_id
     or nullif(trim(coalesce(p_raw_payload->>'provider_order_id', '')), '') is null
     or p_raw_payload->>'currency' is distinct from upper(p_currency)
     or p_raw_payload->>'success' is distinct from (p_status = 'PAID')::text then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_BINDING_MISMATCH';
  end if;
  if coalesce(p_raw_payload->>'amount_cents', '') !~ '^[0-9]+$' then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_AMOUNT_MISMATCH';
  end if;
  v_payload_amount := (p_raw_payload->>'amount_cents')::numeric / 100;
  if v_payload_amount is distinct from p_amount or p_amount is distinct from round(p_amount, 2) then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_AMOUNT_MISMATCH';
  end if;

  select * into v_ledger
  from public.mantigo_financial_ledger
  where id = p_ledger_id
  for update;
  if not found then
    raise exception 'MANTIGO_PAYMENT_LEDGER_NOT_FOUND';
  end if;
  -- Compare provider correlation only after acquiring the ledger lock, against the locked row.
  if p_raw_payload->>'provider_order_id' is distinct from coalesce(v_ledger.metadata->>'paymob_intention_order_id', '') then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_BINDING_MISMATCH';
  end if;
  if p_raw_payload->>'merchant_order_id' is distinct from v_ledger.id then
    raise exception 'MANTIGO_PAYMENT_MERCHANT_REFERENCE_MISMATCH';
  end if;
  if v_ledger.provider is not null and upper(v_ledger.provider) <> 'PAYMOB' then
    raise exception 'MANTIGO_PAYMENT_PROVIDER_MISMATCH';
  end if;
  if v_ledger.gross_amount is distinct from p_amount or v_ledger.gross_amount is distinct from round(v_ledger.gross_amount, 2)
     or v_ledger.currency is null or upper(v_ledger.currency) is distinct from upper(p_currency) then
    raise exception 'MANTIGO_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.mantigo_payment_provider_events
  where provider = 'PAYMOB'
    and external_event_id = p_external_event_id
  limit 1;
  if found then
    if v_event.ledger_id is distinct from v_ledger.id then
      raise exception 'MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH';
    end if;
    if v_event.status is distinct from p_status then
      raise exception 'MANTIGO_PAYMENT_EVENT_REPLAY_STATUS_MISMATCH';
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true,
      'status', v_ledger.payment_status, 'ledger_id', v_ledger.id);
  end if;

  -- A failed attempt may be recovered by a different verified successful transaction.
  -- Once paid, the ledger cannot be rewritten by a later distinct callback.
  if v_ledger.payment_status <> 'PENDING'
     and not (v_ledger.payment_status = 'FAILED' and p_status = 'PAID') then
    return jsonb_build_object('ok', true, 'idempotent', false, 'already_final', true,
      'status', v_ledger.payment_status, 'ledger_id', v_ledger.id);
  end if;

  insert into public.mantigo_payment_provider_events(
    id, ledger_id, provider, event_type, external_event_id,
    status, signature_verified, raw_payload, processed_at
  ) values (
    'paymob-mantigo:' || p_external_event_id, v_ledger.id, 'PAYMOB',
    'MANTIGO_RIDE_PAYMENT', p_external_event_id, p_status, true, p_raw_payload, now()
  )
  on conflict (provider, external_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_event
    from public.mantigo_payment_provider_events
    where provider = 'PAYMOB'
      and external_event_id = p_external_event_id
    limit 1;
    if not found or v_event.ledger_id is distinct from v_ledger.id then
      raise exception 'MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH';
    end if;
    if v_event.status is distinct from p_status then
      raise exception 'MANTIGO_PAYMENT_EVENT_REPLAY_STATUS_MISMATCH';
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true,
      'status', v_ledger.payment_status, 'ledger_id', v_ledger.id);
  end if;

  update public.mantigo_financial_ledger
  set payment_status = p_status,
      payment_reference = p_external_event_id,
      provider_transaction_id = p_provider_transaction_id,
      payment_confirmed_at = case when p_status = 'PAID' then now() else null end,
      updated_at = now()
  where id = v_ledger.id
    and (payment_status = 'PENDING'
      or (payment_status = 'FAILED' and p_status = 'PAID'));
  if not found then
    raise exception 'MANTIGO_PAYMENT_STATE_CHANGED';
  end if;

  insert into public.notifications(
    id, tenant_id, user_id, type, title, body, entity_type, entity_id
  ) values (
    gen_random_uuid()::text, 'MNTY-PLATFORM', v_ledger.customer_id,
    'MANTIGO_PAYMENT',
    case when p_status = 'PAID' then 'تم تأكيد الدفع' else 'تعذر تأكيد الدفع' end,
    case when p_status = 'PAID'
      then 'تم تأكيد الدفع الإلكتروني للرحلة.'
      else 'تعذر تأكيد الدفع الإلكتروني للرحلة.'
    end,
    'MANTIGO_RIDE', v_ledger.ride_id
  );

  return jsonb_build_object('ok', true, 'idempotent', false, 'already_final', false,
    'status', p_status, 'ledger_id', v_ledger.id);
end;
$function$;

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
     or v_intent.amount is distinct from v_order.total
     or v_order.total is distinct from round(v_order.total, 2)
     or p_provider_confirmed_amount is distinct from v_order.total
     or p_provider_confirmed_amount is distinct from round(p_provider_confirmed_amount, 2)
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
     or v_intent.amount is distinct from round(v_intent.amount, 2)
     or p_provider_confirmed_amount is distinct from round(p_provider_confirmed_amount, 2)
     or v_intent.amount is distinct from p_provider_confirmed_amount
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
     or v.amount is distinct from round(v.amount, 2)
     or p_provider_confirmed_amount is distinct from round(p_provider_confirmed_amount, 2)
     or v.amount is distinct from p_provider_confirmed_amount
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

create or replace function public.process_verified_digital_page_payment_backend(
  p_order_id uuid,
  p_external_event_id text,
  p_event_type text,
  p_status text,
  p_signature_verified boolean,
  p_amount numeric,
  p_currency text,
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
  v_order public.digital_page_orders%rowtype;
  v_event public.digital_page_payment_events%rowtype;
  v_next_payment_status text;
  v_next_fulfillment_status text;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'DIGITAL_PAGE_SIGNATURE_REQUIRED';
  end if;
  if nullif(trim(p_external_event_id), '') is null then
    raise exception 'DIGITAL_PAGE_EVENT_ID_REQUIRED';
  end if;
  if p_status is null or p_status not in ('SUCCEEDED', 'FAILED') then
    raise exception 'DIGITAL_PAGE_EVENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0
     or nullif(trim(p_currency), '') is null
     or nullif(trim(p_provider_transaction_id), '') is null
     or nullif(trim(p_provider_order_id), '') is null then
    raise exception 'DIGITAL_PAGE_AMOUNT_CURRENCY_INVALID';
  end if;
  if p_external_event_id is distinct from ('paymob:' || p_provider_transaction_id) then
    raise exception 'DIGITAL_PAGE_EVENT_TRANSACTION_MISMATCH';
  end if;

  -- Serialize all deliveries sharing one provider event ID before locking the target order.
  -- This closes the cross-order race where two sessions both observe no event and race to insert it.
  perform pg_advisory_xact_lock(hashtextextended(p_external_event_id, 0));

  select * into v_order
  from public.digital_page_orders
  where id = p_order_id and provider = 'PAYMOB'
  for update;
  if not found then
    raise exception 'DIGITAL_PAGE_ORDER_NOT_FOUND';
  end if;
  if v_order.provider_order_id is null
     or v_order.provider_order_id <> p_provider_order_id then
    raise exception 'DIGITAL_PAGE_PROVIDER_ORDER_MISMATCH';
  end if;
  if v_order.amount is distinct from round(v_order.amount, 2)
     or p_amount is distinct from round(p_amount, 2)
     or v_order.amount is distinct from p_amount
     or v_order.currency is null or upper(v_order.currency) is distinct from upper(p_currency) then
    raise exception 'DIGITAL_PAGE_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.digital_page_payment_events
  where external_event_id = p_external_event_id
  for update;
  if found then
    if v_event.digital_page_order_id <> v_order.id then
      raise exception 'DIGITAL_PAGE_EVENT_ORDER_MISMATCH';
    end if;
    if v_event.status is distinct from p_status then
      raise exception 'DIGITAL_PAGE_EVENT_REPLAY_STATUS_MISMATCH';
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  end if;

  insert into public.digital_page_payment_events(
    digital_page_order_id, provider, external_event_id, event_type,
    status, signature_verified, raw_payload
  ) values (
    v_order.id, 'PAYMOB', p_external_event_id, p_event_type,
    p_status, true, coalesce(p_raw_payload, '{}'::jsonb)
  );

  if v_order.payment_status <> 'PENDING' then
    return jsonb_build_object(
      'ok', true, 'idempotent', false, 'already_final', true,
      'payment_status', v_order.payment_status,
      'fulfillment_status', v_order.fulfillment_status
    );
  end if;

  v_next_payment_status := case when p_status = 'SUCCEEDED' then 'PAID' else 'FAILED' end;
  v_next_fulfillment_status := case when p_status = 'SUCCEEDED' then 'IN_REVIEW' else v_order.fulfillment_status end;

  update public.digital_page_orders
  set payment_status = v_next_payment_status,
      fulfillment_status = v_next_fulfillment_status,
      provider_transaction_id = p_provider_transaction_id,
      updated_at = now()
  where id = v_order.id and payment_status = 'PENDING';
  if not found then
    raise exception 'DIGITAL_PAGE_PAYMENT_STATE_CHANGED';
  end if;

  return jsonb_build_object(
    'ok', true, 'idempotent', false, 'already_final', false,
    'payment_status', v_next_payment_status,
    'fulfillment_status', v_next_fulfillment_status
  );
end;
$function$;

-- CREATE OR REPLACE preserves existing function ACLs; service-role-only grants from prior
-- migrations remain in force. Apply only through the reviewed migration pipeline.


-- The payment-intent creation RPC must not tolerate mismatches between the two persisted order totals.
-- Preserve the latest RC336 search_path setting and harden only the amount/idempotency comparisons.
create or replace function public.create_payment_intent_backend(
  p_tenant_id character varying,
  p_order_id uuid,
  p_amount numeric,
  p_currency character varying,
  p_provider character varying,
  p_payment_method character varying,
  p_idempotency_key character varying
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id varchar;
  v_order orders%rowtype;
  v_uid uuid := auth.uid();
  v_existing payment_intents%rowtype;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_order from orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.tenant_id<>p_tenant_id then raise exception 'TENANT_MISMATCH'; end if;

  if upper(coalesce(v_order.status,'')) not in ('PENDING','CREATED') then
    raise exception 'ORDER_NOT_PAYABLE';
  end if;

  if v_order.customer_id is distinct from v_uid
     and not exists(
       select 1 from user_memberships m
       where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE'
         and (m.business_id=v_order.business_id or m.business_id is null)
     ) then
    raise exception 'TENANT_ACCESS_DENIED';
  end if;

  if v_order.customer_id is not null and v_order.customer_id<>v_uid and not exists(
    select 1 from user_memberships m
    where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE'
      and m.role in ('OWNER','ADMIN','MANAGER','FINANCE','ACCOUNTANT','FINANCE_MANAGER')
  ) then
    raise exception 'ORDER_ACCESS_DENIED';
  end if;

  if v_order.pricing_hash is null or v_order.pricing_version is null or v_order.pricing_authority is null then raise exception 'PRICING_SNAPSHOT_REQUIRED'; end if;
  if p_amount is null or p_amount<=0
     or v_order.total_amount is distinct from round(v_order.total_amount,2)
     or v_order.total is distinct from round(v_order.total,2)
     or p_amount is distinct from v_order.total_amount
     or p_amount is distinct from v_order.total then raise exception 'INVALID_AMOUNT'; end if;
  if v_order.currency is null or upper(coalesce(p_currency,'')) is distinct from upper(v_order.currency) then raise exception 'INVALID_CURRENCY'; end if;
  if p_provider is null or length(trim(p_provider))=0 then raise exception 'INVALID_PROVIDER'; end if;
  if p_payment_method is null or length(trim(p_payment_method))=0 then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key))=0 or length(p_idempotency_key)>200 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;

  select * into v_existing
  from payment_intents
  where tenant_id=p_tenant_id and idempotency_key=trim(p_idempotency_key)
  for update;

  if found then
    if v_existing.order_id<>p_order_id
       or v_existing.amount is distinct from v_order.total_amount
       or v_existing.amount is distinct from round(v_existing.amount,2)
       or v_existing.currency is null or v_order.currency is null
       or upper(v_existing.currency) is distinct from upper(v_order.currency)
       or v_existing.pricing_hash is distinct from v_order.pricing_hash
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;

    return jsonb_build_object(
      'id',v_existing.id,'status',v_existing.status,'amount',v_existing.amount,
      'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,
      'pricing_hash',v_existing.pricing_hash,'idempotent',true
    );
  end if;

  insert into payment_intents(
    id,tenant_id,order_id,amount,currency,status,provider,payment_method,
    idempotency_key,pricing_version,pricing_hash
  )
  values(
    gen_random_uuid()::text,p_tenant_id,p_order_id,v_order.total_amount,v_order.currency,
    'CREATED',p_provider,p_payment_method,trim(p_idempotency_key),
    v_order.pricing_version,v_order.pricing_hash
  )
  returning id into v_id;

  return jsonb_build_object(
    'id',v_id,'status','CREATED','amount',v_order.total_amount,'currency',v_order.currency,
    'pricing_version',v_order.pricing_version,'pricing_hash',v_order.pricing_hash,'idempotent',false
  );
end
$function$;
