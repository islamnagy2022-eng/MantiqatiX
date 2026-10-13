-- READ-ONLY CATALOG-VERIFIED TEST-ONLY COMPATIBILITY BASELINE
-- Source: read-only pg_catalog/information_schema/pg_policies snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NEVER be applied to production.
-- Injected only into a disposable chronological replay before 20260927140500.
-- Schema/policy only; this file creates no data rows or direct access privileges.

create table public.smm_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.smm_providers(id) on delete cascade,
  external_service_id text not null,
  platform text not null,
  category text not null,
  name text not null,
  description text,
  provider_cost numeric(18,8) not null default 0 check (provider_cost >= 0),
  selling_price numeric(18,8) not null default 0 check (selling_price >= 0),
  min_quantity bigint not null default 1 check (min_quantity > 0),
  max_quantity bigint not null default 1000000 check (max_quantity >= min_quantity),
  refill boolean not null default false,
  cancel boolean not null default false,
  dripfeed boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smm_services_provider_id_external_service_id_key unique (provider_id, external_service_id)
);

create index smm_services_platform_idx on public.smm_services(platform, active);
alter table public.smm_services enable row level security;

create policy smm_services_public_read
  on public.smm_services
  for select
  to anon, authenticated
  using (active = true);
