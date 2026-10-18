-- TEST-ONLY schema compatibility baseline for disposable migration-chain replay.
-- Authoritative source: tracked migration 20261006152000_mantigo_financial_ledger_v1.sql.
-- The earlier notification lifecycle migration 20261006140601 references this table
-- before the tracked creation source's timestamp. This exact table DDL is copied
-- into a temporary migration immediately before that consumer in disposable CI only.
-- It contains no rows and is not a historical migration. Never apply to production.

create table if not exists public.mantigo_financial_ledger (
  id text primary key,
  ride_id text not null unique references public.mantigo_rides(id) on delete restrict,
  customer_id uuid not null,
  captain_id uuid not null,
  currency text not null default 'EGP',
  gross_amount numeric(14,2) not null check (gross_amount > 0),
  commission_rate numeric(6,3),
  commission_amount numeric(14,2) not null default 0 check (commission_amount >= 0),
  captain_net_amount numeric(14,2) not null default 0 check (captain_net_amount >= 0),
  payment_method text,
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
