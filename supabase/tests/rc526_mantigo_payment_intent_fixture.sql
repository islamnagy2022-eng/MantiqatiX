-- RC526 disposable PostgreSQL fixture only. No production data.
-- Preserve the ledger's production NOT NULL/check constraints relevant to inserts and updates.
create table public.mantigo_financial_ledger (
  id text primary key,
  ride_id text not null unique,
  customer_id uuid not null,
  captain_id uuid not null,
  currency text not null default 'EGP',
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission_rate numeric(6,3),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  captain_net_amount numeric(14,2) not null default 0 check (captain_net_amount >= 0),
  payment_method text,
  provider text,
  provider_intent_id text,
  provider_transaction_id text,
  payment_status text not null default 'REQUIRED' check (payment_status in ('REQUIRED','PENDING','PAID','FAILED','REFUNDED','CASH_CONFIRMED')),
  settlement_status text not null default 'NOT_READY' check (settlement_status in ('NOT_READY','READY','SETTLED','HELD','CANCELLED')),
  payment_reference text,
  settlement_reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  payment_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mantigo_financial_provider_intent_uidx
  on public.mantigo_financial_ledger(provider, provider_intent_id)
  where provider_intent_id is not null;


-- Disposable auth/admin/audit fixtures for the operator reconciliation RPC.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create table public.user_memberships (
  user_id uuid not null,
  tenant_id text not null,
  status text not null,
  role text not null,
  permissions jsonb not null default '{}'::jsonb
);

create or replace function public.mnty_can_platform_admin()
returns boolean
language sql
stable
as $function$
  select exists (
    select 1 from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = 'MNTY-PLATFORM'
      and m.status = 'ACTIVE'
      and upper(m.role) = 'SUPER_ADMIN'
      and coalesce(m.permissions ->> 'scope' = 'PLATFORM', false)
      and coalesce((m.permissions ->> 'full_control')::boolean, false)
  )
$function$;

create table public.audit_logs (
  id text primary key,
  tenant_id text,
  actor_user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  result text
);
