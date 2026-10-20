-- Disposable fixture for RC428-RC430. Never apply to production.
create table public.orders (
  id uuid primary key,
  tenant_id text not null,
  status text not null,
  pricing_hash text,
  pricing_version integer,
  pricing_authority text,
  total numeric,
  currency text
);
create table public.payment_intents (
  id uuid primary key,
  tenant_id text not null,
  order_id uuid not null,
  provider text not null,
  status text not null,
  provider_order_id text,
  pricing_hash text,
  pricing_version integer,
  amount numeric,
  currency text,
  updated_at timestamptz not null default now()
);
create table public.businesses (
  id uuid primary key,
  tenant_id text not null
);
create table public.user_memberships (
  user_id uuid not null,
  business_id uuid not null,
  status text not null,
  role text not null,
  created_at timestamptz not null default now()
);
create table public.subscription_payment_intents (
  id uuid primary key,
  business_id uuid not null,
  tier_code text not null,
  billing_cycle text not null,
  sector text,
  amount numeric,
  currency text,
  status text not null,
  provider text not null,
  provider_order_id text,
  provider_transaction_id text,
  created_by uuid not null,
  updated_at timestamptz not null default now()
);
create table public.payment_provider_events (
  id text primary key,
  tenant_id text not null,
  provider text not null,
  event_type text not null,
  payment_intent_id uuid,
  external_event_id text not null,
  status text not null,
  signature_verified boolean not null,
  raw_payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  unique(provider, external_event_id)
);
create table public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  tier_code text not null,
  billing_cycle text not null,
  status text not null,
  sector text,
  starts_at timestamptz,
  ends_at timestamptz,
  provider text,
  provider_reference text,
  source_payment_intent_id uuid,
  idempotency_key text unique,
  created_by uuid,
  updated_at timestamptz not null default now()
);
create function public.legal_assert_action(p_user_id uuid,p_action_key text,p_business_id uuid)
returns void language plpgsql as $legal$
begin
  return;
end;
$legal$;
