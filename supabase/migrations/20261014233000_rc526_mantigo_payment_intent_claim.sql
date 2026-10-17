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

create or replace function public.reconcile_mantigo_payment_intent_backend(
  p_admin_user_id uuid,
  p_ledger_id text,
  p_resolution text,
  p_evidence_reference text,
  p_confirmed_amount numeric default null,
  p_confirmed_currency text default null,
  p_provider_intent_id text default null,
  p_provider_order_id text default null,
  p_client_secret text default null,
  p_payment_methods jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_resolution text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_resolution, '')));
  v_evidence text := pg_catalog.btrim(coalesce(p_evidence_reference, ''));
  v_ledger public.mantigo_financial_ledger%rowtype;
  v_audit_id text := 'AUD-MG-' || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  v_reconciliation jsonb;
begin
  if v_actor is null or p_admin_user_id is null or v_actor <> p_admin_user_id then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_AUTH_REQUIRED';
  end if;
  if not public.mnty_can_platform_admin() then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_PLATFORM_ADMIN_REQUIRED';
  end if;
  if p_ledger_id is null or v_evidence = '' or pg_catalog.length(v_evidence) > 512 then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_EVIDENCE_REQUIRED';
  end if;
  if v_resolution not in ('PROVIDER_INTENT_CONFIRMED', 'PROVIDER_INTENT_ABSENT') then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_RESOLUTION_INVALID';
  end if;

  select * into v_ledger
  from public.mantigo_financial_ledger
  where id = p_ledger_id
  for update;
  if not found then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_LEDGER_NOT_FOUND';
  end if;
  if v_ledger.payment_status <> 'REQUIRED'
     or v_ledger.provider is not null
     or v_ledger.provider_intent_id is not null
     or not (coalesce(v_ledger.metadata, '{}'::jsonb) ? 'paymob_intent_claim')
     or not exists (
       select 1 from public.mantigo_payment_intent_claims c
       where c.ledger_id = p_ledger_id
     )
     or exists (
       select 1 from public.mantigo_payment_intent_secrets s
       where s.ledger_id = p_ledger_id
     ) then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_STATE_NOT_ELIGIBLE';
  end if;

  v_reconciliation := pg_catalog.jsonb_build_object(
    'resolution', v_resolution,
    'evidence_reference', v_evidence,
    'actor_user_id', v_actor,
    'reconciled_at', pg_catalog.now()
  );

  if v_resolution = 'PROVIDER_INTENT_CONFIRMED' then
    if p_confirmed_amount is null
       or p_confirmed_amount <> v_ledger.gross_amount
       or p_confirmed_currency is null
       or pg_catalog.upper(pg_catalog.btrim(p_confirmed_currency)) <> pg_catalog.upper(v_ledger.currency)
       or nullif(pg_catalog.btrim(p_provider_intent_id), '') is null
       or nullif(pg_catalog.btrim(p_provider_order_id), '') is null
       or nullif(pg_catalog.btrim(p_client_secret), '') is null then
      raise exception 'PAYMENT_INTENT_RECONCILIATION_PROVIDER_DETAILS_MISMATCH';
    end if;

    update public.mantigo_financial_ledger
    set provider = 'PAYMOB',
        provider_intent_id = p_provider_intent_id,
        payment_method = 'CARD',
        payment_status = 'PENDING',
        metadata = (coalesce(metadata, '{}'::jsonb) - 'paymob_intent_claim') || pg_catalog.jsonb_build_object(
          'paymob_intention_order_id', p_provider_order_id,
          'paymob_payment_methods', p_payment_methods,
          'paymob_intent_reconciliation', v_reconciliation
        ),
        updated_at = pg_catalog.now()
    where id = p_ledger_id
      and payment_status = 'REQUIRED'
      and provider is null
      and provider_intent_id is null;
    if not found then
      raise exception 'PAYMENT_INTENT_RECONCILIATION_STATE_CHANGED';
    end if;

    insert into public.mantigo_payment_intent_secrets(ledger_id, client_secret, updated_at)
    values (p_ledger_id, p_client_secret, pg_catalog.now());
    delete from public.mantigo_payment_intent_claims where ledger_id = p_ledger_id;

    insert into public.audit_logs(id, tenant_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, result)
    values (
      v_audit_id, 'MNTY-PLATFORM', v_actor, 'MANTIGO_PAYMENT_INTENT_RECONCILED',
      'MANTIGO_FINANCIAL', p_ledger_id,
      pg_catalog.jsonb_build_object('payment_status', v_ledger.payment_status, 'provider', v_ledger.provider),
      pg_catalog.jsonb_build_object('payment_status', 'PENDING', 'provider', 'PAYMOB',
        'provider_intent_id', p_provider_intent_id, 'provider_order_id', p_provider_order_id,
        'resolution', v_resolution, 'evidence_reference', v_evidence),
      'SUCCESS'
    );

    return pg_catalog.jsonb_build_object('ledger_id', p_ledger_id, 'status', 'PENDING', 'resolution', v_resolution);
  end if;

  if p_confirmed_amount is not null
     or p_confirmed_currency is not null
     or p_provider_intent_id is not null
     or p_provider_order_id is not null
     or p_client_secret is not null
     or p_payment_methods is not null then
    raise exception 'PAYMENT_INTENT_ABSENCE_MUST_NOT_INCLUDE_PROVIDER_DETAILS';
  end if;

  update public.mantigo_financial_ledger
  set metadata = (coalesce(metadata, '{}'::jsonb) - 'paymob_intent_claim') || pg_catalog.jsonb_build_object(
        'paymob_intent_reconciliation', v_reconciliation
      ),
      updated_at = pg_catalog.now()
  where id = p_ledger_id
    and payment_status = 'REQUIRED'
    and provider is null
    and provider_intent_id is null;
  if not found then
    raise exception 'PAYMENT_INTENT_RECONCILIATION_STATE_CHANGED';
  end if;

  delete from public.mantigo_payment_intent_claims where ledger_id = p_ledger_id;
  insert into public.audit_logs(id, tenant_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, result)
  values (
    v_audit_id, 'MNTY-PLATFORM', v_actor, 'MANTIGO_PAYMENT_INTENT_RECONCILED',
    'MANTIGO_FINANCIAL', p_ledger_id,
    pg_catalog.jsonb_build_object('payment_status', v_ledger.payment_status, 'provider', v_ledger.provider),
    pg_catalog.jsonb_build_object('payment_status', 'REQUIRED', 'provider', null,
      'resolution', v_resolution, 'evidence_reference', v_evidence),
    'SUCCESS'
  );

  return pg_catalog.jsonb_build_object('ledger_id', p_ledger_id, 'status', 'REQUIRED', 'resolution', v_resolution, 'retry_allowed', true);
end;
$function$;

revoke all on function public.claim_mantigo_payment_intent_backend(text, text) from public, anon, authenticated;
revoke all on function public.finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.release_mantigo_payment_intent_claim_backend(text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_mantigo_payment_intent_backend(text, text) to service_role;
grant execute on function public.finalize_mantigo_payment_intent_backend(text, text, text, text, text, jsonb) to service_role;
grant execute on function public.release_mantigo_payment_intent_claim_backend(text, text, integer) to service_role;
revoke all on function public.reconcile_mantigo_payment_intent_backend(uuid, text, text, text, numeric, text, text, text, text, jsonb) from public, anon, service_role;
grant execute on function public.reconcile_mantigo_payment_intent_backend(uuid, text, text, text, numeric, text, text, text, text, jsonb) to authenticated;
