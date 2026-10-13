-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved: 2026-10-11 for isolated disposable migration replay only.
-- Source: read-only PostgreSQL catalog introspection of production project moyhiluyhjsujhwlyeuu,
-- table public.smm_providers, observed 2026-10-11. No provider rows or api_url values were queried.
-- This is a schema baseline for test replay, not a historical production migration.
-- Never apply this file to production and never move it into supabase/migrations.
-- Includes observed columns, defaults, PK/unique constraints, RLS policy and service_role table grants.

create table public.smm_providers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  api_url text not null,
  api_style text not null default 'generic',
  active boolean not null default false,
  priority integer not null default 100,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smm_providers_pkey primary key (id),
  constraint smm_providers_name_key unique (name)
);

alter table public.smm_providers enable row level security;

create policy deny_direct_access_authenticated
  on public.smm_providers
  for all
  to authenticated
  using (false)
  with check (false);

revoke all on table public.smm_providers from public, anon, authenticated, service_role;
grant references, trigger, truncate on table public.smm_providers to service_role;
