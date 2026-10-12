-- OWNER-APPROVED TEST-ONLY LEGACY TABLE BASELINE
-- Authorized by the project owner on 2026-10-12 for disposable CI replay only.
-- The applied Phase 04 migration modifies an already-existing public.products table.
-- That legacy table is absent from today's live catalog and its original creation DDL is not in the applied ledger.
-- The base fields below are limited to the Phase 04 prerequisites and the archived source's documented marketplace model.
-- Later Phase 04 statements add the enterprise columns and constraints in timestamp order.
-- This is NOT recovered historical DDL. Never apply this file to production; no production rows are included.

create table public.products (
  id uuid primary key,
  business_id uuid not null references public.businesses(id) on delete restrict,
  sku character varying(128) not null,
  name character varying(255) not null,
  created_at timestamptz not null default current_timestamp
);
