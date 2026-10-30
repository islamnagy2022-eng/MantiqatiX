-- Disposable PostgreSQL 16 fixture for RC435 and RC439. Never run against Production.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $roles$
begin create role anon nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role authenticated nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role service_role nologin; exception when duplicate_object then null; end
$roles$;

create table public.user_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null,
  business_id uuid not null,
  status text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table public.subscription_tier_prices (
  tier_code text primary key,
  monthly_price numeric(12,2) not null,
  annual_price numeric(12,2) not null,
  currency text not null,
  active boolean not null default true
);

create table public.subscription_payment_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null,
  tier_code text not null,
  billing_cycle text not null,
  sector text,
  amount numeric(12,2) not null,
  currency text not null,
  status text not null,
  provider text not null,
  provider_intent_id text,
  provider_order_id text,
  provider_transaction_id text,
  idempotency_key text not null unique,
  pricing_hash text,
  created_by uuid not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.legal_assert_action(p_actor uuid,p_action text,p_business uuid)
returns void language plpgsql
as $function$
begin
  if current_setting('mantiqatix_test.legal_fail',true)='true' then
    raise exception 'TEST_LEGAL_CLEARANCE_DENIED';
  end if;
end;
$function$;
