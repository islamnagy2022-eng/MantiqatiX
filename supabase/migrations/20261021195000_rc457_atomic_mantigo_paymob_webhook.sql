-- RC457: atomically persist verified MantiGO Paymob events and transition the financial ledger.
-- Source-only migration. Do not apply to production without ordered migration review and rehearsal.
create or replace function public.process_verified_mantigo_paymob_event(
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
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_ledger public.mantigo_financial_ledger%rowtype;
  v_event public.payment_provider_events%rowtype;
  v_status text;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'MANTIGO_SIGNATURE_REQUIRED';
  end if;
  if p_external_event_id is null or length(trim(p_external_event_id)) = 0 then
    raise exception 'MANTIGO_EVENT_ID_REQUIRED';
  end if;
  if p_status is null or p_status not in ('PAID', 'FAILED') then
    raise exception 'MANTIGO_EVENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0 or p_currency is null or length(trim(p_currency)) = 0 then
    raise exception 'MANTIGO_AMOUNT_CURRENCY_INVALID';
  end if;

  select * into v_ledger
  from public.mantigo_financial_ledger
  where id = p_ledger_id
  for update;
  if not found then
    raise exception 'MANTIGO_LEDGER_NOT_FOUND';
  end if;
  if v_ledger.provider is distinct from 'PAYMOB' then
    raise exception 'MANTIGO_PROVIDER_MISMATCH';
  end if;
  if coalesce(p_raw_payload #>> '{obj,order,merchant_order_id}', p_raw_payload #>> '{order,merchant_order_id}') is distinct from v_ledger.id then
    raise exception 'MANTIGO_MERCHANT_REFERENCE_MISMATCH';
  end if;
  if abs(v_ledger.gross_amount - p_amount) > 0.01
     or upper(v_ledger.currency) <> upper(p_currency) then
    raise exception 'MANTIGO_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.payment_provider_events
  where provider = 'PAYMOB' and external_event_id = p_external_event_id
  for update;

  if found then
    if coalesce(v_event.raw_payload #>> '{obj,order,merchant_order_id}', v_event.raw_payload #>> '{order,merchant_order_id}') is distinct from v_ledger.id
       or v_event.event_type is distinct from 'MANTIGO_RIDE_PAYMENT'
       or v_event.signature_verified is distinct from true
       or v_event.status is null or v_event.status not in ('PAID', 'FAILED') then
      raise exception 'MANTIGO_EVENT_BINDING_CONFLICT';
    end if;
    if v_event.status is distinct from p_status then
      raise exception 'MANTIGO_EVENT_STATUS_CONFLICT';
    end if;
    v_status := v_event.status;
    if v_ledger.payment_status = 'PENDING' then
      update public.mantigo_financial_ledger
      set payment_status = v_status,
          payment_reference = p_external_event_id,
          provider_transaction_id = coalesce(nullif(p_provider_transaction_id, ''), provider_transaction_id),
          payment_confirmed_at = case when v_status = 'PAID' then coalesce(payment_confirmed_at, now()) else null end,
          updated_at = now()
      where id = v_ledger.id;
      return jsonb_build_object('ok', true, 'idempotent', true, 'recovered', true, 'status', v_status);
    end if;
    if v_ledger.payment_status = v_status then
      return jsonb_build_object('ok', true, 'idempotent', true, 'recovered', false, 'status', v_status);
    end if;
    raise exception 'MANTIGO_FINAL_STATE_CONFLICT';
  end if;

  if v_ledger.payment_status <> 'PENDING' then
    raise exception 'MANTIGO_PAYMENT_ALREADY_FINAL';
  end if;

  insert into public.payment_provider_events(
    id, tenant_id, provider, event_type, payment_intent_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  ) values (
    gen_random_uuid()::text, 'MNTY-PLATFORM', 'PAYMOB', 'MANTIGO_RIDE_PAYMENT',
    null, p_external_event_id, p_status, true,
    coalesce(p_raw_payload, '{}'::jsonb), now()
  );

  update public.mantigo_financial_ledger
  set payment_status = p_status,
      payment_reference = p_external_event_id,
      provider_transaction_id = nullif(p_provider_transaction_id, ''),
      payment_confirmed_at = case when p_status = 'PAID' then now() else null end,
      updated_at = now()
  where id = v_ledger.id and payment_status = 'PENDING';

  return jsonb_build_object('ok', true, 'idempotent', false, 'recovered', false, 'status', p_status);
end;
$function$;

revoke all on function public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb) from public;
revoke all on function public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb) from anon;
revoke all on function public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb) from authenticated;
grant execute on function public.process_verified_mantigo_paymob_event(text,text,text,boolean,numeric,text,text,jsonb) to service_role;
