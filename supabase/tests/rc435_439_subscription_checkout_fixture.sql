-- Disposable PostgreSQL 16 fixture for RC435 and RC439.
-- Production-required columns and key constraints are represented explicitly.
-- Never run against Production.
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

create table public.tenants (
  id varchar primary key
);

create table public.organizations (
  id varchar primary key
);

create table public.businesses (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id varchar not null references public.tenants(id),
  organization_id varchar references public.organizations(id),
  name varchar not null,
  code varchar not null,
  status varchar not null default 'ACTIVE'
    check (status in ('ACTIVE','INACTIVE','SUSPENDED')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

create table public.branches (
  id varchar primary key,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  organization_id varchar references public.organizations(id) on delete restrict,
  business_id uuid not null references public.businesses(id),
  name varchar not null,
  code varchar not null,
  status varchar not null default 'ACTIVE',
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  constraint uk_branch_biz_code unique (business_id, code)
);

create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  organization_id varchar references public.organizations(id) on delete set null,
  business_id uuid references public.businesses(id),
  branch_id varchar references public.branches(id) on delete cascade,
  role varchar not null,
  permissions jsonb default '[]'::jsonb,
  status varchar not null default 'ACTIVE',
  created_at timestamptz not null default current_timestamp,
  constraint uk_user_biz_branch unique (user_id, business_id, branch_id)
);

create table public.subscription_tier_prices (
  tier_code text primary key,
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  annual_price numeric(12,2) not null check (annual_price >= 0),
  currency text not null default 'EGP' check (currency = 'EGP'),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.subscription_payment_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  tier_code text not null references public.subscription_tier_prices(tier_code),
  billing_cycle text not null check (billing_cycle in ('MONTHLY','ANNUAL')),
  sector text,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'EGP' check (currency = 'EGP'),
  status text not null default 'CREATED'
    check (status in ('CREATED','PENDING','SUCCEEDED','FAILED','CANCELLED','PAID_PENDING_LEGAL','EXPIRED')),
  provider text not null default 'PAYMOB',
  provider_intent_id text,
  provider_order_id text,
  provider_transaction_id text,
  idempotency_key text not null unique,
  pricing_hash text not null,
  created_by uuid not null,
  expires_at timestamptz not null default (now() + interval '1 hour'),
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
