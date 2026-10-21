-- RC457 disposable PostgreSQL fixture; never apply this fixture to production.
create extension if not exists pgcrypto;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end
$roles$;

create table public.mantigo_financial_ledger (
  id text primary key,
  provider text,
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  currency text not null default 'EGP',
  payment_status text not null default 'PENDING',
  payment_reference text,
  provider_transaction_id text,
  payment_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.payment_provider_events (
  id varchar primary key,
  tenant_id text not null,
  provider text not null,
  event_type text not null,
  payment_intent_id text not null,
  external_event_id text not null,
  status text,
  signature_verified boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  unique(provider, external_event_id)
);

create or replace function public.rc457_test_fail_ledger_update()
returns trigger language plpgsql as $function$
begin
  if current_setting('test.fail_ledger_update', true) = 'on' then
    raise exception 'SIMULATED_LEDGER_WRITE_FAILURE';
  end if;
  return new;
end;
$function$;

create trigger rc457_test_fail_ledger_update
before update on public.mantigo_financial_ledger
for each row execute function public.rc457_test_fail_ledger_update();
