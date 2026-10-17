-- RC526 disposable PostgreSQL fixture only. No production data.
-- Preserve the ledger's production NOT NULL/check constraints relevant to inserts and updates.
create table public.mantigo_financial_ledger (
  id text primary key,
  ride_id text not null unique,
  customer_id uuid not null,
  captain_id uuid not null,
  currency text not null default 'EGP',
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission_rate numeric(6,3),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  captain_net_amount numeric(14,2) not null default 0 check (captain_net_amount >= 0),
  payment_method text,
  provider text,
  provider_intent_id text,
  provider_transaction_id text,
  payment_status text not null default 'REQUIRED' check (payment_status in ('REQUIRED','PENDING','PAID','FAILED','REFUNDED','CASH_CONFIRMED')),
  settlement_status text not null default 'NOT_READY' check (settlement_status in ('NOT_READY','READY','SETTLED','HELD','CANCELLED')),
  payment_reference text,
  settlement_reference text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  payment_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mantigo_financial_provider_intent_uidx
  on public.mantigo_financial_ledger(provider, provider_intent_id)
  where provider_intent_id is not null;
