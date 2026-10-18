-- TEST-ONLY schema compatibility baseline for disposable migration-chain replay.
-- Authoritative source: tracked migration 20261006152000_mantigo_financial_ledger_v1.sql.
-- The repository replay order currently runs the RLS hardening migration
-- 20261006122111 before this table-creation source. This exact table DDL is
-- copied into a temporary migration immediately before that earlier consumer
-- in disposable CI only. It is not a new historical migration and must never
-- be applied to production or used to alter the production migration ledger.

create table if not exists public.mantigo_financial_config (
  id boolean primary key default true check (id=true),
  commission_rate numeric(6,3) not null check (commission_rate>=0 and commission_rate<=100),
  currency text not null default 'EGP',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
