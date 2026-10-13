-- OWNER-APPROVED TEST-ONLY SCHEMA BASELINE
-- Approved by the project owner on 2026-10-12 for isolated disposable CI replay only.
-- Source: read-only PostgreSQL catalog introspection of production project moyhiluyhjsujhwlyeuu.
-- This is a live-derived compatibility bootstrap, NOT recovered historical creation DDL.
-- Never apply this file to production or move it into supabase/migrations.
-- profile_image_path is deliberately omitted because the committed migration
-- 20260927103103_add_provider_profile_media.sql adds it in timestamp order.
-- No production rows or user data are included.

create table public.marketing_provider_profiles (
  id uuid not null default gen_random_uuid(),
  provider_kind character varying not null,
  business_id uuid,
  owner_user_id uuid,
  name_ar character varying not null,
  name_en character varying,
  slug character varying not null,
  description text,
  specialties jsonb not null default '[]'::jsonb,
  service_areas jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  status character varying not null default 'PENDING'::character varying,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  ranking_weight numeric not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint marketing_provider_profiles_pkey primary key (id),
  constraint marketing_provider_profiles_business_id_fkey
    foreign key (business_id) references public.businesses(id) on delete set null,
  constraint marketing_provider_profiles_owner_user_id_fkey
    foreign key (owner_user_id) references auth.users(id) on delete set null,
  constraint marketing_provider_profiles_provider_kind_check
    check (provider_kind::text = any (array['OFFICIAL'::character varying, 'PARTNER_COMPANY'::character varying, 'FREELANCER'::character varying]::text[])),
  constraint marketing_provider_profiles_slug_key unique (slug),
  constraint marketing_provider_profiles_status_check
    check (status::text = any (array['PENDING'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'INACTIVE'::character varying]::text[]))
);

create index idx_mkt_provider_status_kind
  on public.marketing_provider_profiles using btree (status, provider_kind);

alter table public.marketing_provider_profiles enable row level security;
alter table public.marketing_provider_profiles force row level security;

create policy "CRM managers view marketing providers"
  on public.marketing_provider_profiles for select to authenticated
  using (
    exists (
      select 1 from public.user_memberships um
      where um.user_id = auth.uid()
        and um.status = 'ACTIVE'
        and upper(coalesce(um.role::text, '')) = any (array['SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'])
    )
  );

create policy "Owners manage their marketing provider profile"
  on public.marketing_provider_profiles for all to authenticated
  using (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and auth.uid() = owner_user_id
  )
  with check (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and auth.uid() = owner_user_id
  );

create policy "Public can view active marketing providers"
  on public.marketing_provider_profiles for select to anon, authenticated
  using (status = 'ACTIVE');

revoke all on table public.marketing_provider_profiles from public, anon, authenticated, service_role;
grant select on table public.marketing_provider_profiles to anon;
grant delete, insert, select, update on table public.marketing_provider_profiles to authenticated;
grant references, trigger, truncate on table public.marketing_provider_profiles to service_role;
