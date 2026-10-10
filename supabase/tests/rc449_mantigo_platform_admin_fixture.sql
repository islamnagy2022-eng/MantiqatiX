-- Disposable fixture for RC449 platform-admin scope integration tests only.
create extension if not exists pgcrypto;
do $roles$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;

create table public.user_memberships (
  id text primary key,
  user_id uuid not null,
  tenant_id text not null,
  role text not null,
  status text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


-- Minimal operational tables needed for PL/pgSQL row types and guarded RPC compilation.
create table public.mantigo_rides (
  id text primary key,
  customer_id uuid,
  status text,
  updated_at timestamptz not null default now()
);

create table public.mantigo_financial_ledger (
  id text primary key,
  ride_id text,
  captain_id uuid,
  gross_amount numeric,
  commission_amount numeric,
  captain_net_amount numeric,
  commission_rate numeric,
  payment_status text,
  settlement_status text,
  settlement_reference text,
  amount numeric,
  captain_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id text primary key,
  tenant_id text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  result text
);

create table public.notifications (
  id text primary key,
  tenant_id text,
  user_id uuid,
  type text,
  title text,
  body text,
  entity_type text,
  entity_id text
);

-- Test-only stand-in for the ledger/journal writer called by RC449.
-- It deliberately performs no real accounting writes; the integration test checks
-- authorization, the RPC's ledger state transition, audit row, notification, and replay.
create or replace function public.create_settlement_and_post_journal(
  p_settlement_id character varying,
  p_tenant_id character varying,
  p_party_type character varying,
  p_party_id character varying,
  p_gross_amount numeric,
  p_commission_amount numeric,
  p_net_amount numeric,
  p_tax_amount numeric,
  p_channel character varying,
  p_ride_id character varying,
  p_payment_method_id uuid,
  p_description text,
  p_actor_user_id uuid
)
returns jsonb
language sql
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'settlement_id', p_settlement_id,
    'tenant_id', p_tenant_id,
    'ride_id', p_ride_id,
    'actor_user_id', p_actor_user_id,
    'test_fixture', true
  )
$function$;