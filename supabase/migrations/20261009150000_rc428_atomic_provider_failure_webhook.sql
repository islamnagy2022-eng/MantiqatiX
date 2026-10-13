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

  if v_intent.tenant_id::text <> p_tenant_id
     or v_order.tenant_id::text <> p_tenant_id
     or upper(v_intent.provider::text) <> upper(p_provider) then
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
     or abs(v_intent.amount - v_order.total) > 0.01
     or abs(p_provider_confirmed_amount - v_order.total) > 0.01
     or upper(v_intent.currency::text) <> upper(v_order.currency::text)
     or upper(p_provider_confirmed_currency) <> upper(v_order.currency::text) then
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
