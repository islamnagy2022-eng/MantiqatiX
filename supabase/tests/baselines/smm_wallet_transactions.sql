-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Source: read-only pg_catalog/information_schema/pg_policies snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NEVER be applied to production.
-- Injected only into a disposable chronological replay before 20260927140500.
-- Schema/policy only; this file creates no data rows or direct access privileges.

create table public.smm_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18,8) not null,
  type text not null check (type = any (array['CREDIT','DEBIT','REFUND','ADJUSTMENT']::text[])),
  reference_id uuid,
  description text,
  created_at timestamptz not null default now()
);

alter table public.smm_wallet_transactions enable row level security;

create policy smm_wallet_tx_owner_read
  on public.smm_wallet_transactions
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
