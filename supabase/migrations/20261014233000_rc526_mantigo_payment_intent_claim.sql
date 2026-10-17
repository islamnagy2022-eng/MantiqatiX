-- RC526: atomically claim and finalize MantiGO Paymob intentions.
-- Claim tokens and checkout secrets live only in service-role-only tables, never ledger metadata.
-- External Paymob requests must not begin until claim succeeds.

create table if not exists public.mantigo_payment_intent_claims (
  ledger_id text primary key references public.mantigo_financial_ledger(id) on delete cascade,
  claim_token text not null,
  created_at timestamptz not null default now()
);
alter table public.mantigo_payment_intent_claims enable row level security;
revoke all on table public.mantigo_payment_intent_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.mantigo_payment_intent_claims to service_role;
drop policy if exists mantigo_payment_intent_claims_service_role on public.mantigo_payment_intent_claims;
create policy mantigo_payment_intent_claims_service_role on public.mantigo_payment_intent_claims
  for all to service_role using (true) with check (true);

create table if not exists public.mantigo_payment_intent_secrets (
  ledger_id text primary key references public.mantigo_financial_ledger(id) on delete cascade,
  client_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mantigo_payment_intent_secrets enable row level security;
revoke all on table public.mantigo_payment_intent_secrets from public, anon, authenticated;
grant select, insert, update, delete on table public.mantigo_payment_intent_secrets to service_role;
drop policy if exists mantigo_payment_intent_secrets_service_role on public.mantigo_payment_intent_secrets;
create policy mantigo_payment_intent_secrets_service_role on public.mantigo_payment_intent_secrets
  for all to service_role using (true) with check (true);

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
        'paymob_intent_claim', pg_catalog.jsonb_build_object('created_at', pg_catalog.now())
      ),
      updated_at = pg_catalog.now()
  where id = p_ledger_id
    and payment_status = 'REQUIRED'
    and provider is null
    and provider_intent_id is null
    and not (coalesce(metadata, '{}'::jsonb) ? 'paymob_intent_claim')
    and not exists (select 1 from public.mantigo_payment_intent_claims c where c.ledger_id = p_ledger_id)
    and not exists (select 1 from public.mantigo_payment_intent_secrets s where s.ledger_id = p_ledger_id);

  if not found then
    return false;
  end if;

  insert into public.mantigo_payment_intent_claims(ledger_id, claim_token)
  values (p_ledger_id, p_claim_token);

  return true;
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
        'paymob_intention_order_id', p_provider_order_id,
        'paymob_payment_methods', p_payment_methods
      ),
      updated_at = pg_catalog.now()
  where id = p_ledger_id
    and payment_status = 'REQUIRED'
    and provider is null
    and provider_intent_id is null
    and metadata ? 'paymob_intent_claim'
    and exists (
      select 1 from public.mantigo_payment_intent_claims c
      where c.ledger_id = p_ledger_id and c.claim_token = p_claim_token
    );

  if not found then
    return false;
  end if;

  insert into public.mantigo_payment_intent_secrets(ledger_id, client_secret, updated_at)
  values (p_ledger_id, p_client_secret, pg_catalog.now());

  delete from public.mantigo_payment_intent_claims
  where ledger_id = p_ledger_id and claim_token = p_claim_token;

  return true;
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
declare
  v_released boolean;
begin
  if p_ledger_id is null
     or nullif(pg_catalog.btrim(p_claim_token), '') is null
     or p_http_status is null
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
    and metadata ? 'paymob_intent_claim'
    and exists (
      select 1 from public.mantigo_payment_intent_claims c
      where c.ledger_id = p_ledger_id and c.claim_token = p_claim_token
    );

  v_released := found;
  if not v_released then
    return false;
  end if;

  delete from public.mantigo_payment_intent_claims
  where ledger_id = p_ledger_id and claim_token = p_claim_token;

  return true;
end;
$function$;

revoke all on function public.claim_mantigo_payment_intent_backend(text, text) from public, anon, authenticated;
revoke all on function public.finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.release_mantigo_payment_intent_claim_backend(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_mantigo_payment_intent_backend(text, text) to service_role;
grant execute on function public.finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.release_mantigo_payment_intent_claim_backend(text, text, integer) to service_role;
