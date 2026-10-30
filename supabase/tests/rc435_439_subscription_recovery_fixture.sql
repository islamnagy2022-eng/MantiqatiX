-- Disposable PostgreSQL 16 fixture for RC435 and RC439. Never run against Production.
do $roles$
begin create role anon nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role authenticated nologin; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role service_role nologin; exception when duplicate_object then null; end
$roles$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.businesses (
  id uuid primary key,
  tenant_id text not null
);

create table public.user_memberships (
  user_id uuid not null,
  business_id uuid not null references public.businesses(id),
  status text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table public.subscription_tier_prices (
  tier_code text primary key,
  monthly_price numeric(12,2),
  annual_price numeric(12,2),
  currency text not null,
  active boolean not null default true
);

create table public.subscription_payment_intents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  tier_code text not null,
  billing_cycle text not null,
  sector text,
  amount numeric(12,2) not null,
  currency text not null,
  status text not null,
  provider text not null,
  idempotency_key text not null unique,
  pricing_hash text,
  created_by uuid not null,
  provider_intent_id text,
  provider_order_id text,
  provider_transaction_id text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.legal_assert_action(
  p_actor_user_id uuid,
  p_action text,
  p_business_id uuid
)
returns void language plpgsql
as $function$
begin
  if current_setting('mantiqatix_test.legal_fail', true) = 'true' then
    raise exception 'TEST_LEGAL_BLOCKED';
  end if;
end;
$function$;
