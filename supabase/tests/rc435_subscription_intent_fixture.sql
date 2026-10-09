-- Disposable fixture for RC435 subscription provider-creation claim tests.
create schema extensions;
create extension pgcrypto with schema extensions;

create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null,
  status varchar not null
);
create table public.user_memberships (
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid not null,
  role varchar not null,
  status varchar not null
);
create table public.subscription_tier_prices (
  tier_code text primary key,
  monthly_price numeric(12,2),
  annual_price numeric(12,2),
  currency text not null default 'EGP',
  active boolean not null default true
);
create table public.subscription_payment_intents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  tier_code text not null,
  billing_cycle text not null,
  sector text,
  amount numeric not null,
  currency text not null default 'EGP',
  status text not null check(status in ('CREATED','PENDING','SUCCEEDED','FAILED','CANCELLED','PAID_PENDING_LEGAL','EXPIRED')),
  provider text not null default 'PAYMOB',
  provider_intent_id text,
  provider_order_id text,
  provider_transaction_id text,
  idempotency_key text not null unique,
  pricing_hash text not null,
  created_by uuid not null,
  expires_at timestamptz not null default (now()+interval '1 hour'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_creation_state text not null default 'LEGACY_UNRECONCILED'
    check(provider_creation_state in ('LEGACY_UNRECONCILED','READY','CLAIMED','CORRELATED','RECONCILIATION_REQUIRED')),
  provider_creation_claimed_at timestamptz
);
create function public.legal_assert_action(p_user_id uuid,p_action_key text,p_business_id uuid)
returns void language plpgsql as $legal$
begin
  return;
end;
$legal$;
