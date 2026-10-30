-- Disposable PostgreSQL 16 fixture for RC428–RC430 only. Never run against Production.
do $roles$
begin
  create role anon nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated nologin;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role nologin;
exception when duplicate_object then null;
end
$roles$;

create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null
);

create table public.orders (
  id uuid primary key,
  tenant_id varchar not null,
  status varchar not null,
  total numeric,
  currency varchar not null,
  pricing_version bigint,
  pricing_hash varchar,
  pricing_authority varchar
);

create table public.payment_intents (
  id varchar primary key,
  tenant_id varchar not null,
  order_id uuid not null references public.orders(id),
  amount numeric not null,
  currency varchar not null,
  status varchar not null,
  provider varchar not null,
  provider_order_id text,
  pricing_version bigint,
  pricing_hash varchar,
  updated_at timestamptz not null default now()
);

create table public.payment_provider_events (
  id varchar primary key,
  tenant_id varchar not null,
  provider varchar not null,
  event_type varchar not null,
  payment_intent_id varchar,
  external_event_id varchar not null,
  status varchar not null,
  signature_verified boolean not null,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, external_event_id)
);

create table public.subscription_payment_intents (
  id uuid primary key,
  business_id uuid not null references public.businesses(id),
  tier_code text not null,
  billing_cycle text not null,
  sector text,
  amount numeric not null,
  currency text not null,
  status text not null,
  provider text not null,
  provider_order_id text,
  provider_transaction_id text,
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

create table public.user_memberships (
  user_id uuid not null,
  business_id uuid not null references public.businesses(id),
  status text not null,
  role text not null,
  created_at timestamptz not null default now()
);

create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  tier_code text not null,
  billing_cycle text not null,
  status text not null,
  sector text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  provider text,
  provider_reference text,
  source_payment_intent_id uuid,
  idempotency_key text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.legal_assert_action(
  p_actor_user_id uuid,
  p_action text,
  p_business_id uuid
)
returns void
language plpgsql
as $function$
begin
  if current_setting('mantiqatix_test.legal_fail', true) = 'true' then
    raise exception 'TEST_LEGAL_BLOCKED';
  end if;
end;
$function$;
