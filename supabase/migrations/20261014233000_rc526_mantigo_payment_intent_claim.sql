-- RC526: atomically claim and finalize MantiGO Paymob intentions.
-- Service-role-only RPCs. External Paymob requests must not begin until claim succeeds.
-- Finalization only succeeds for the exact claim token and REQUIRED ledger state.

create or replace function public.claim_mantigo_payment_intent_backend(
  p_ledger_id text,
  p_claim_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_ledger_id is null or nullif(pg_catalog.btrim(p_claim_token), '') is null then
    raise exception 'PAYMENT_INTENT_CLAIM_ARGUMENTS_REQUIRED';
  end if;

  update public.mantigo_financial_ledger
  set metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'paymob_intent_claim',
        pg_catalog.jsonb_build_object('token', p_claim_token, 'created_at', pg_catalog.now())
      ),
      updated_at = pg_catalog.now()
  where id = p_ledger_id
    and payment_status = 'REQUIRED'
    and provider_intent_id is null
    and provider is null
    and not (coalesce(metadata, '{}'::jsonb) ? 'paymob_intent_claim');

  return found;
end;
$function$;

create or replace function public.finalize_mantigo_payment_intent_backend(
  p_ledger_id text,
  p_claim_token text,
  p_provider_intent_id text,
  p_provider_order_id text,
  p_client_secret text,
  p_payment_methods jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_ledger_id is null
     or nullif(pg_catalog.btrim(p_claim_token), '') is null
     or nullif(pg_catalog.btrim(p_provider_intent_id), '') is null
     or nullif(pg_catalog.btrim(p_provider_order_id), '') is null
     or nullif(pg_catalog.btrim(p_client_secret), '') is null then
    raise exception 'PAYMENT_INTENT_FINALIZATION_ARGUMENTS_REQUIRED';
  end if;

  update public.mantigo_financial_ledger
  set provider = 'PAYMOB',
      provider_intent_id = p_provider_intent_id,
      payment_method = 'CARD',
      payment_status = 'PENDING',
      metadata = (coalesce(metadata, '{}'::jsonb) - 'paymob_intent_claim') || pg_catalog.jsonb_build_object(
        'paymob_client_secret', p_client_secret,
        'paymob_intention_order_id', p_provider_order_id,
        'paymob_payment_methods', p_payment_methods
      ),
      updated_at = pg_catalog.now()
  where id = p_ledger_id
    and payment_status = 'REQUIRED'
    and provider_intent_id is null
    and metadata -> 'paymob_intent_claim' ->> 'token' = p_claim_token;

  return found;
end;
$function$;

create or replace function public.release_mantigo_payment_intent_claim_backend(
  p_ledger_id text,
  p_claim_token text,
  p_http_status integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_ledger_id is null
     or nullif(pg_catalog.btrim(p_claim_token), '') is null
     or p_http_status not in (400, 401, 403, 404, 422) then
    raise exception 'PAYMENT_INTENT_RELEASE_STATUS_NOT_DEFINITIVE';
  end if;

  update public.mantigo_financial_ledger
  set metadata = (coalesce(metadata, '{}'::jsonb) - 'paymob_intent_claim') || pg_catalog.jsonb_build_object(
        'paymob_intent_last_rejection',
        pg_catalog.jsonb_build_object('http_status', p_http_status, 'rejected_at', pg_catalog.now())
      ),
      updated_at = pg_catalog.now()
  where id = p_ledger_id
    and payment_status = 'REQUIRED'
    and provider is null
    and provider_intent_id is null
    and metadata -> 'paymob_intent_claim' ->> 'token' = p_claim_token;

  return found;
end;
$function$;

revoke all on function public.claim_mantigo_payment_intent_backend(text, text) from public, anon, authenticated;
revoke all on function public.finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_mantigo_payment_intent_backend(text, text) to service_role;
grant execute on function public.finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb) to service_role;
revoke all on function public.release_mantigo_payment_intent_claim_backend(text, text, integer) from public, anon, authenticated;
grant execute on function public.release_mantigo_payment_intent_claim_backend(text, text, integer) to service_role;
