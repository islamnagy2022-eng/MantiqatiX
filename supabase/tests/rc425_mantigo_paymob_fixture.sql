-- RC425 disposable PostgreSQL fixture for atomic MantiGo Paymob processing.
create table public.mantigo_financial_ledger (
  id text primary key,
  ride_id text not null,
  customer_id uuid not null,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  gross_amount numeric not null,
  currency text not null,
  payment_status text not null default 'PENDING',
  payment_reference text,
  provider_transaction_id text,
  payment_confirmed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id text primary key,
  tenant_id text not null,
  user_id uuid not null,
  type text not null,
  title text not null,
  body text not null,
  entity_type text not null,
  entity_id text not null
);
