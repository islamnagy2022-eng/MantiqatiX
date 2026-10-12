-- OWNER-APPROVED TEST-ONLY LEGACY TABLE BASELINE
-- Authorized by the project owner on 2026-10-12 for disposable CI replay only.
-- The applied Phase 04 migration modifies an already-existing public.businesses table.
-- The live migration ledger does not contain its original creation DDL.
-- This minimal pre-Phase-04 shape is inferred only for compatibility replay; it is NOT historical DDL.
-- Never apply this file to production. No production rows are included.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name character varying(255) not null,
  code character varying(64) not null,
  status character varying(32) not null default 'ACTIVE',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);
