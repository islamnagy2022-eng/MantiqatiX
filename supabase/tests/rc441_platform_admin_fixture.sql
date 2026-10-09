-- Disposable fixture for RC441 platform-admin scope integration tests only.
create extension if not exists pgcrypto;
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
