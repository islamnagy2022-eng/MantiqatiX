-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Source: read-only pg_catalog/information_schema/pg_policies snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NEVER be applied to production.
-- Injected only into a disposable chronological replay immediately before RC456.
-- Schema/policy only; this file creates no data rows or direct access privileges.

create table public.smm_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(18,8) not null default 0 check (balance >= 0),
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

alter table public.smm_wallets enable row level security;

create policy smm_wallet_owner_read
  on public.smm_wallets
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
