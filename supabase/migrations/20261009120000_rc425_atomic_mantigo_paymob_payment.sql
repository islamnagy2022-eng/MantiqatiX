-- RC425: atomically persist Paymob MantiGo events, ledger state, and customer notification.
-- Source-only until reviewed and applied through the migration pipeline.

-- Keep MantiGo ride-ledger events separate from payment_intents events.
create table if not exists public.mantigo_payment_provider_events (
  id text primary key,
  ledger_id text not null references public.mantigo_financial_ledger(id) on delete restrict,
  provider text not null check (provider = 'PAYMOB'),
  event_type text not null,
  external_event_id text not null,
  status text not null check (status in ('PAID', 'FAILED')),
  signature_verified boolean not null check (signature_verified is true),
  payload_hash text,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mantigo_payment_provider_events_provider_event_key unique (provider, external_event_id)
);

alter table public.mantigo_payment_provider_events enable row level security;
alter table public.mantigo_payment_provider_events force row level security;
revoke all on table public.mantigo_payment_provider_events from public, anon, authenticated, service_role;

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
     or p_raw_payload->>'provider_order_id' is distinct from coalesce((select metadata->>'paymob_intention_order_id' from public.mantigo_financial_ledger where id=p_ledger_id), '')
     or p_raw_payload->>'currency' is distinct from upper(p_currency)
     or p_raw_payload->>'success' is distinct from (p_status = 'PAID')::text then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_BINDING_MISMATCH';
  end if;
  if coalesce(p_raw_payload->>'amount_cents', '') !~ '^[0-9]+$' then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_AMOUNT_MISMATCH';
  end if;
  v_payload_amount := (p_raw_payload->>'amount_cents')::numeric / 100;
  if abs(v_payload_amount - p_amount) > 0.01 then
    raise exception 'MANTIGO_PAYMENT_PAYLOAD_AMOUNT_MISMATCH';
  end if;

  select * into v_ledger
  from public.mantigo_financial_ledger
  where id = p_ledger_id
  for update;
  if not found then
    raise exception 'MANTIGO_PAYMENT_LEDGER_NOT_FOUND';
  end if;
  if p_raw_payload->>'merchant_order_id' is distinct from v_ledger.id then
    raise exception 'MANTIGO_PAYMENT_MERCHANT_REFERENCE_MISMATCH';
  end if;
  if v_ledger.provider is not null and upper(v_ledger.provider) <> 'PAYMOB' then
    raise exception 'MANTIGO_PAYMENT_PROVIDER_MISMATCH';
  end if;
  if abs(v_ledger.gross_amount - p_amount) > 0.01
     or upper(v_ledger.currency) <> upper(p_currency) then
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

revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from public;
revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from anon;
revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from authenticated;
grant execute on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) to service_role;
