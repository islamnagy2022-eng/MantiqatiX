-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved: 2026-10-14 for isolated disposable migration replay only.
-- Source: read-only PostgreSQL catalog introspection of production public.smm_admins
-- in Supabase project moyhiluyhjsujhwlyeuu.
-- This is NOT recovered historical DDL. Never apply this file to production.
-- No production rows or user identifiers are included.
-- Preserve observed behavior: RLS enabled, no policies, no direct client privileges.
create table public.smm_admins (
  user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint smm_admins_pkey primary key (user_id),
  constraint smm_admins_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete cascade
);

alter table public.smm_admins enable row level security;

revoke all on table public.smm_admins
  from public, anon, authenticated, service_role;

grant references, trigger, truncate on table public.smm_admins
  to service_role;
