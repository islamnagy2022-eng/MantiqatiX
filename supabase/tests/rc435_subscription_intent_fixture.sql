-- Disposable fixture for RC435 subscription provider-creation claim tests.
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
create table public.subscription_payment_intents (
  id uuid primary key,
  business_id uuid not null,
  created_by uuid not null,
  status text not null check(status in ('CREATED','PENDING','SUCCEEDED','FAILED','CANCELLED','PAID_PENDING_LEGAL','EXPIRED')),
  provider_intent_id text,
  provider_order_id text,
  updated_at timestamptz not null default now()
);
