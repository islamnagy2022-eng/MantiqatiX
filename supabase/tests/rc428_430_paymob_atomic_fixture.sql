-- Disposable-only schema for RC428/RC429/RC430 atomic Paymob transition integration.
create extension if not exists pgcrypto;

do $roles$
begin
  if not exists(select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='service_role') then create role service_role nologin; end if;
end
$roles$;

create table public.businesses (
  id uuid primary key,
  tenant_id text not null
);

create table public.orders (
  id uuid primary key,
  tenant_id text not null,
  status text not null,
  pricing_hash text,
  pricing_version integer,
  pricing_authority text,
  total numeric(18,2),
  currency text
);

create table public.payment_intents (
  id uuid primary key,
  tenant_id text not null,
  order_id uuid not null references public.orders(id),
  provider text not null,
  provider_order_id text,
  amount numeric(18,2) not null,
  currency text not null,
  status text not null,
  pricing_version integer,
  pricing_hash text,
  updated_at timestamptz not null default now()
);

create table public.payment_provider_events (
  id text primary key,
  tenant_id text not null,
  provider text not null,
  event_type text not null,
  payment_intent_id text,
  external_event_id text not null,
  status text not null,
  signature_verified boolean not null,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  unique(provider, external_event_id)
);

create table public.subscription_payment_intents (
  id uuid primary key,
  business_id uuid not null references public.businesses(id),
  amount numeric(18,2) not null,
  currency text not null,
  status text not null,
  provider text not null,
  provider_order_id text,
  provider_transaction_id text,
  tier_code text not null,
  billing_cycle text not null,
  sector text not null,
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

create table public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  user_id uuid not null,
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
  sector text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  provider text not null,
  provider_reference text not null,
  source_payment_intent_id uuid not null references public.subscription_payment_intents(id),
  idempotency_key text not null,
  created_by uuid not null,
  updated_at timestamptz not null default now()
);

-- The integration exercises the payment transaction boundary, not the legal subsystem.
create or replace function public.legal_assert_action(p_actor uuid, p_action text, p_business uuid)
returns void language plpgsql as $function$
begin
  if p_actor is null or p_action <> 'SUBSCRIPTION_ACTIVATION' or p_business is null then
    raise exception 'TEST_LEGAL_GUARD_INVALID_CONTEXT';
  end if;
  return;
end;
$function$;
