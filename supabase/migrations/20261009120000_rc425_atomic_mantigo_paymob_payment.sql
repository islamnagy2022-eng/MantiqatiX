-- RC425: atomically persist Paymob MantiGo events, ledger state, and customer notification.
-- Source-only until merged and applied through the reviewed migration pipeline.
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
set search_path = public, pg_temp
as $function$
declare
  v_ledger public.mantigo_financial_ledger%rowtype;
  v_event public.payment_provider_events%rowtype;
  v_inserted_id varchar;
begin
  if coalesce(p_signature_verified, false) is not true then
    raise exception 'MANTIGO_PAYMENT_SIGNATURE_REQUIRED';
  end if;
  if nullif(trim(p_external_event_id), '') is null then
    raise exception 'MANTIGO_PAYMENT_EVENT_ID_REQUIRED';
  end if;
  if p_status not in ('PAID', 'FAILED') then
    raise exception 'MANTIGO_PAYMENT_STATUS_INVALID';
  end if;
  if p_amount is null or p_amount <= 0 or nullif(trim(p_currency), '') is null then
    raise exception 'MANTIGO_PAYMENT_AMOUNT_CURRENCY_INVALID';
  end if;

  select * into v_ledger
  from public.mantigo_financial_ledger
  where id = p_ledger_id
  for update;
  if not found then
    raise exception 'MANTIGO_PAYMENT_LEDGER_NOT_FOUND';
  end if;
  if v_ledger.provider is not null and upper(v_ledger.provider) <> 'PAYMOB' then
    raise exception 'MANTIGO_PAYMENT_PROVIDER_MISMATCH';
  end if;
  if abs(v_ledger.gross_amount - p_amount) > 0.01
     or upper(v_ledger.currency) <> upper(p_currency) then
    raise exception 'MANTIGO_AMOUNT_CURRENCY_MISMATCH';
  end if;

  select * into v_event
  from public.payment_provider_events
  where provider = 'PAYMOB'
    and external_event_id = p_external_event_id
  limit 1;
  if found then
    if v_event.payment_intent_id is distinct from v_ledger.id then
      raise exception 'MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH';
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'status', v_ledger.payment_status,
      'ledger_id', v_ledger.id
    );
  end if;

  if v_ledger.payment_status <> 'PENDING' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', false,
      'already_final', true,
      'status', v_ledger.payment_status,
      'ledger_id', v_ledger.id
    );
  end if;

  insert into public.payment_provider_events(
    id, tenant_id, provider, event_type, payment_intent_id,
    external_event_id, status, signature_verified, raw_payload, processed_at
  ) values (
    'paymob-mantigo:' || p_external_event_id,
    'MNTY-PLATFORM',
    'PAYMOB',
    'MANTIGO_RIDE_PAYMENT',
    v_ledger.id,
    p_external_event_id,
    p_status,
    true,
    coalesce(p_raw_payload, '{}'::jsonb),
    now()
  )
  on conflict (provider, external_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    select * into v_event
    from public.payment_provider_events
    where provider = 'PAYMOB'
      and external_event_id = p_external_event_id
    limit 1;
    if not found or v_event.payment_intent_id is distinct from v_ledger.id then
      raise exception 'MANTIGO_PAYMENT_EVENT_ORDER_MISMATCH';
    end if;
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'status', v_ledger.payment_status,
      'ledger_id', v_ledger.id
    );
  end if;

  update public.mantigo_financial_ledger
  set payment_status = p_status,
      payment_reference = 'paymob:' || p_external_event_id,
      provider_transaction_id = p_provider_transaction_id,
      payment_confirmed_at = case when p_status = 'PAID' then now() else null end,
      updated_at = now()
  where id = v_ledger.id
    and payment_status = 'PENDING';

  if not found then
    raise exception 'MANTIGO_PAYMENT_STATE_CHANGED';
  end if;

  insert into public.notifications(
    id, tenant_id, user_id, type, title, body, entity_type, entity_id
  ) values (
    gen_random_uuid()::text,
    'MNTY-PLATFORM',
    v_ledger.customer_id,
    'MANTIGO_PAYMENT',
    case when p_status = 'PAID' then 'تم تأكيد الدفع' else 'تعذر تأكيد الدفع' end,
    case when p_status = 'PAID'
      then 'تم تأكيد الدفع الإلكتروني للرحلة.'
      else 'تعذر تأكيد الدفع الإلكتروني للرحلة.'
    end,
    'MANTIGO_RIDE',
    v_ledger.ride_id
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'already_final', false,
    'status', p_status,
    'ledger_id', v_ledger.id
  );
end;
$function$;

revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from public;
revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from anon;
revoke all on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) from authenticated;
grant execute on function public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb) to service_role;
