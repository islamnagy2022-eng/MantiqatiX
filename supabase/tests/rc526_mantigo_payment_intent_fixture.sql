-- RC526 disposable PostgreSQL fixture only. No production data.
create table public.mantigo_financial_ledger (
  id uuid primary key,
  ride_id text not null unique,
  customer_id uuid not null,
  currency text not null default 'EGP',
  gross_amount numeric not null,
  payment_status text not null,
  provider text,
  provider_intent_id text,
  payment_method text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
