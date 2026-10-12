-- OWNER-APPROVED TEST-ONLY LEGACY TABLE BASELINE (private schema)
-- Authorized 2026-10-12 for isolated disposable CI replay only.
-- Production catalog source: Supabase project moyhiluyhjsujhwlyeuu (read-only).
-- This is a live-derived compatibility bootstrap, NOT recovered historical DDL.
-- Never apply this file to production. No production rows are included.
-- Schema ACL observed: postgres owns private; USAGE for authenticated and service_role only.
-- Table shape, PK, FK and deny policy are observed from the live catalog.
-- RLS enablement remains owned by the ordered lock_platform_admins_rls migration.

create schema private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated, service_role;

create table private.platform_admins (
  user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  constraint platform_admins_pkey primary key (user_id),
  constraint platform_admins_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

revoke all on table private.platform_admins from public, anon, authenticated, service_role;
grant all on table private.platform_admins to service_role;

create policy mnty_deny_unexposed_platform_admins
  on private.platform_admins for all to anon, authenticated
  using (false)
  with check (false);
