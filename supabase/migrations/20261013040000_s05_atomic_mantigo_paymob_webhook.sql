-- S05: atomically persist a verified MantiGO Paymob event and transition its ledger row.
-- Source-only on the S05 review branch. Do not apply to production without isolated validation and approval.
create or replace function public.process_verified_mantigo_payment_backend(
  p_ledger_id text,
  p_external_event_id text,
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
set search_path = public, pg_temp
as $function$
declare
  v_ledger public.mantigo_financial_ledger%rowtype;
  v_event public.payment_provider_events%rowtype;
  v_rows integer;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'MANTIGO_SIGNATURE_REQUIRED';
  end if;
  if p_ledger_id is null or length(trim(p_ledger_id)) = 0
     or p_external_event_id is null or length(trim(p_external_event_id)) = 0
     or p_provider_transaction_id is null or length(trim(p_provider_transaction_id)) = 0 then
    raise exception 'MANTIGO_PAYMENT_EVENT_FIELDS_REQUIRED';
  end if;
  if p_status not in ('PAID', 'FAILED') then
    raise exception 'MANTIGO_PAYMENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0 or p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'MANTIGO_AMOUNT_CURRENCY_INVALID';
  end if;
  if p_provider_order_id is null or length(trim(p_provider_order_id)) = 0 then
    raise exception 'MANTIGO_PROVIDER_ORDER_REQUIRED';
  end if;

  select * into v_ledger
  from public.mantigo_financial_ledger
  where id = p_ledger_id
  for update;
  if not found then
    raise exception 'MANTIGO_LEDGER_NOT_FOUND';
  end if;
  if v_ledger.provider is distinct from 'PAYMOB'
     or coalesce(v_ledger.provider_intent_id, '') = ''
     or coalesce(v_ledger.metadata->>'paymob_intention_order_id', '') <> p_provider_order_id then
    raise exception 'MANTIGO_PROVIDER_ORDER_MISMATCH';
  end if;
  if abs(v_ledger.gross_amount - p_amount) > 0.01
     or upper(v_ledger.currency) <> upper(p_currency) then
    raise exception 'MANTIGO_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.payment_provider_events
  where provider = 'PAYMOB' and external_event_id = p_external_event_id;
  if found then
    if v_event.payment_intent_id::text is distinct from v_ledger.id then
      raise exception 'MANTIGO_EVENT_LEDGER_MISMATCH';
    end if;
    if v_event.status is distinct from p_status
       or v_ledger.payment_status is distinct from p_status then
      raise exception 'MANTIGO_EVENT_LEDGER_INCONSISTENT';
    end if;
    return jsonb_build_object('ok', true, 'idempotent', true, 'applied', false, 'status', v_ledger.payment_status);
  end if;

  if v_ledger.payment_status <> 'PENDING' then
    raise exception 'MANTIGO_PAYMENT_STATE_NOT_PENDING';
  end if;

  insert into public.payment_provider_events(
    id, tenant_id, provider, event_type, payment_intent_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  ) values (
    gen_random_uuid(), 'MNTY-PLATFORM', 'PAYMOB', 'MANTIGO_RIDE_PAYMENT',
    v_ledger.id, p_external_event_id, p_status, true,
    coalesce(p_raw_payload, '{}'::jsonb), now()
  );

  update public.mantigo_financial_ledger
  set payment_status = p_status,
      payment_reference = p_external_event_id,
      provider_transaction_id = p_provider_transaction_id,
      payment_confirmed_at = case when p_status = 'PAID' then now() else null end,
      updated_at = now()
  where id = v_ledger.id and payment_status = 'PENDING';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'MANTIGO_PAYMENT_STATE_TRANSITION_FAILED';
  end if;

  return jsonb_build_object('ok', true, 'idempotent', false, 'applied', true, 'status', p_status);
end;
$function$;

revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,text,jsonb) from public;
revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,text,jsonb) from anon;
revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,text,jsonb) from authenticated;
grant execute on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,text,jsonb) to service_role;
