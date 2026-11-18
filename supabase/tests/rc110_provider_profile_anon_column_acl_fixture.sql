-- Disposable PostgreSQL fixture for provider-profile public column ACL.
-- Never run against Production. Mirrors only the relevant ACL/RLS shape.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt()
returns jsonb language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create table public.marketing_provider_profiles (
  id uuid primary key,
  business_id uuid,
  name_ar text not null,
  name_en text,
  provider_kind text not null,
  description text,
  slug text not null unique,
  status text not null,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  owner_user_id uuid,
  settings jsonb not null default '{}'::jsonb
);

insert into public.marketing_provider_profiles(
  id,business_id,name_ar,provider_kind,slug,status,is_verified,owner_user_id,settings
) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','مقدم خدمة نشط','OFFICIAL','active-provider','ACTIVE',true,'30000000-0000-4000-8000-000000000001','{"private_flag":"do-not-expose"}'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','مقدم غير نشط','OFFICIAL','inactive-provider','INACTIVE',false,'30000000-0000-4000-8000-000000000002','{"private_flag":"inactive"}');

alter table public.marketing_provider_profiles enable row level security;
alter table public.marketing_provider_profiles force row level security;
create policy provider_profiles_public_active_read
  on public.marketing_provider_profiles
  for select to anon, authenticated
  using (status = 'ACTIVE');

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;

-- Start with the broad legacy table grant, then apply the proposed anon boundary.
grant select on public.marketing_provider_profiles to anon, authenticated, service_role;
revoke select on table public.marketing_provider_profiles from anon;
grant select (
  id,business_id,name_ar,name_en,provider_kind,description,slug,status,is_verified,is_featured
) on table public.marketing_provider_profiles to anon;
