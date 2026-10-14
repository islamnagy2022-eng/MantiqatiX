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
  if upper(v_intent.provider) <> 'PAYMOB'
     or v_intent.provider_order_id is null
     or v_intent.provider_order_id <> p_provider_order_id then
    raise exception 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH';
  end if;
  if abs(v_intent.amount - round(p_provider_confirmed_amount, 2)) > 0.01
     or upper(v_intent.currency) <> upper(p_provider_confirmed_currency) then
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
