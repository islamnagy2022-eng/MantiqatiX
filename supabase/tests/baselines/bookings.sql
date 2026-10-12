-- OWNER-APPROVED TEST-ONLY LEGACY TABLE BASELINE
-- Explicit owner instruction on 2026-10-12: unblock historical migration replay using
-- a separately labelled disposable-only compatibility baseline.
-- Source: read-only PostgreSQL catalog introspection of production project moyhiluyhjsujhwlyeuu.
-- This is a minimal live-derived compatibility shape, NOT recovered historical creation DDL.
-- Only the observed id/created_at columns and primary key are represented here.
-- RLS, policies and grants are intentionally left to the timestamp-ordered migration chain;
-- current live policy/grant metadata does not prove historical state before production hardening.
-- Never apply this file to production or commit it under supabase/migrations.
-- No production rows, booking payloads, or customer data are included.

create table public.bookings (
  id uuid not null default gen_random_uuid(),
  created_at timestamp without time zone default now(),
  constraint bookings_pkey primary key (id)
);
