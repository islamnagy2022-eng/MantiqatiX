-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved: 2026-10-14 for disposable migration replay only.
-- Source: read-only PostgreSQL catalog introspection of production public.provider_onboarding_requests
-- in Supabase project moyhiluyhjsujhwlyeuu. No production rows or user data were queried.
-- This is NOT recovered historical DDL and does NOT repair the source migration-order defect.
-- The tracked chain references this table at 20261001090000, before its tracked CREATE TABLE at 20261001164200.
-- This fixture only lets disposable CI continue to find downstream blockers. Never apply this file to production.
-- No policies are included: chronological migrations own policy creation and FORCE RLS.

create table public.provider_onboarding_requests (
  id uuid not null default gen_random_uuid(),
  registration_request_id uuid not null,
  user_id uuid not null,
  tenant_id varchar not null,
  organization_id varchar,
  business_name varchar not null,
  provider_kind varchar not null,
  name_en varchar,
  description text,
  specialties jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  profile_image_path text,
  status varchar not null default 'PENDING',
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_onboarding_requests_pkey primary key (id),
  constraint provider_onboarding_requests_registration_request_id_key unique (registration_request_id),
  constraint provider_onboarding_requests_registration_request_id_fkey
    foreign key (registration_request_id)
    references public.account_registration_requests(id)
    on delete cascade,
  constraint provider_onboarding_requests_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint provider_onboarding_requests_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id),
  constraint provider_onboarding_requests_organization_id_fkey
    foreign key (organization_id) references public.organizations(id),
  constraint provider_onboarding_requests_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id),
  constraint provider_onboarding_requests_status_check
    check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  constraint provider_onboarding_kind_chk
    check (length(trim(provider_kind)) between 2 and 80),
  constraint provider_onboarding_user_role_chk
    check (length(trim(business_name)) between 2 and 180)
);

create index if not exists idx_provider_onboarding_requests_organization_id
  on public.provider_onboarding_requests (organization_id);
create index if not exists idx_provider_onboarding_requests_reviewed_by
  on public.provider_onboarding_requests (reviewed_by);
create index if not exists idx_provider_onboarding_requests_tenant_id
  on public.provider_onboarding_requests (tenant_id);
create index if not exists idx_provider_onboarding_status
  on public.provider_onboarding_requests (status, created_at desc);
create index if not exists idx_provider_onboarding_user_status
  on public.provider_onboarding_requests (user_id, status, created_at desc);

alter table public.provider_onboarding_requests enable row level security;

revoke all on table public.provider_onboarding_requests
  from public, anon, authenticated, service_role;
grant references, trigger, truncate on table public.provider_onboarding_requests
  to service_role;
