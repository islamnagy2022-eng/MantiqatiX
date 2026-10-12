-- OWNER-APPROVED TEST-ONLY LEGACY TABLE BASELINE
-- Authorized by the project owner on 2026-10-12 for disposable CI replay only.
-- The applied Phase 04 migration modifies an already-existing public.orders table.
-- The applied ledger does not contain its original creation DDL.
-- This minimal pre-Phase-04 shape preserves the columns that Phase 04 expects to pre-exist.
-- This is NOT recovered historical DDL. Never apply this file to production; no production rows are included.

create table public.orders (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_id uuid,
  status character varying(64) not null default 'NEW',
  total numeric(14,4) not null default 0,
  created_at timestamptz not null default current_timestamp
);
