-- TEST-ONLY LIVE-DERIVED TABLE COMPATIBILITY FIXTURE
-- Source: read-only catalog introspection of Supabase project moyhiluyhjsujhwlyeuu on 2026-10-12.
-- This fixture restores the table shape needed to replay later migrations because the
-- repository does not contain its historical CREATE TABLE migration.
-- NOT recovered historical creation DDL. Foreign keys and RLS policies are intentionally
-- not asserted by this compatibility fixture; later migrations must be validated separately.
-- No rows are inserted. MUST NOT be applied to production.

create table public.marketing_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  provider_kind varchar not null
    constraint marketing_provider_profiles_provider_kind_check
    check (provider_kind in ('OFFICIAL','PARTNER_COMPANY','FREELANCER')),
  business_id uuid,
  owner_user_id uuid,
  name_ar varchar not null,
  name_en varchar,
  slug varchar not null unique,
  description text,
  specialties jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  status varchar not null default 'PENDING'
    constraint marketing_provider_profiles_status_check
    check (status in ('PENDING','ACTIVE','SUSPENDED','INACTIVE')),
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  ranking_weight numeric not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_mkt_provider_status_kind
  on public.marketing_provider_profiles (status, provider_kind);
alter table public.marketing_provider_profiles enable row level security;
alter table public.marketing_provider_profiles force row level security;
