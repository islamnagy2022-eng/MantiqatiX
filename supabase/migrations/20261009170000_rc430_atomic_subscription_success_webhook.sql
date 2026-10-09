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
  if upper(v.provider) <> 'PAYMOB'
     or v.provider_order_id is null
     or v.provider_order_id <> p_provider_order_id then
    raise exception 'SUBSCRIPTION_PROVIDER_ORDER_MISMATCH';
  end if;
  if abs(v.amount - round(p_provider_confirmed_amount, 2)) > 0.01
     or upper(v.currency) <> upper(p_provider_confirmed_currency) then
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
