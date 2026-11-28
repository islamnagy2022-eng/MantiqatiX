create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid() returns uuid
language sql stable
as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
create or replace function auth.jwt() returns jsonb
language sql stable
as 'select coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb';
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;

create table public.businesses (
  id uuid primary key,
  tenant_id text not null,
  name text not null
);
create table public.user_memberships (
  id text primary key,
  user_id uuid not null,
  tenant_id text not null,
  business_id uuid,
  role text not null,
  status text not null
);
alter table public.user_memberships enable row level security;
create policy memberships_select_self
  on public.user_memberships for select to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and auth.uid() = user_id
  );

alter table public.businesses enable row level security;
create policy businesses_member_select
  on public.businesses for select to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and exists (
      select 1 from public.user_memberships um
      where um.user_id = auth.uid()
        and um.tenant_id = businesses.tenant_id
        and um.status = 'ACTIVE'
    )
  );

create table public.marketing_provider_profiles (
  id uuid primary key,
  business_id uuid,
  owner_user_id uuid,
  provider_kind text not null,
  name_ar text not null,
  slug text not null,
  profile_image_path text,
  settings jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING',
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  ranking_weight numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.marketing_provider_profiles enable row level security;

-- Test mirror of the forward-only RC931 owner branding guard. RC116 stays immutable.
-- The JSONB settings column is wider than the owner branding capability.
-- Keep owner self-service to the provider logo path; platform-managed metadata
-- remains writable only through trusted platform/service-role workflows.
create or replace function public.mnty_guard_provider_profile_branding_only()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_old_settings jsonb;
  v_new_settings jsonb;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_old_settings := coalesce(old.settings, '{}'::jsonb);
  v_new_settings := coalesce(new.settings, '{}'::jsonb);

  if (v_new_settings - 'branding') is distinct from (v_old_settings - 'branding') then
    raise exception 'PROVIDER_PROFILE_OWNER_SETTINGS_NOT_BRANDING'
      using errcode = '42501';
  end if;

  if v_new_settings ? 'branding'
     and pg_catalog.jsonb_typeof(v_new_settings->'branding') is distinct from 'object' then
    raise exception 'PROVIDER_PROFILE_OWNER_BRANDING_OBJECT_REQUIRED'
      using errcode = '42501';
  end if;

  if (coalesce(v_new_settings->'branding', '{}'::jsonb) - 'logo_path')
       is distinct from
     (coalesce(v_old_settings->'branding', '{}'::jsonb) - 'logo_path') then
    raise exception 'PROVIDER_PROFILE_OWNER_SETTINGS_NOT_BRANDING'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

drop trigger if exists mnty_provider_profile_branding_only on public.marketing_provider_profiles;
create trigger mnty_provider_profile_branding_only
  before update of settings on public.marketing_provider_profiles
  for each row
  execute function public.mnty_guard_provider_profile_branding_only();
create policy "Owners manage their marketing provider profile"
  on public.marketing_provider_profiles for all to authenticated
  using (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and auth.uid() = owner_user_id
  )
  with check (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and auth.uid() = owner_user_id
  );
create policy "Public can view active marketing providers"
  on public.marketing_provider_profiles for select to anon, authenticated
  using (status = 'ACTIVE');

create table public.marketing_leads (
  id uuid primary key,
  requester_user_id uuid,
  requester_business_id uuid,
  title text not null,
  currency text not null default 'EGP',
  status text not null default 'OPEN',
  source text not null default 'PLATFORM',
  assigned_provider_id uuid,
  created_at timestamptz not null default now()
);
alter table public.marketing_leads enable row level security;
create policy "Users create marketing leads"
  on public.marketing_leads for insert to authenticated
  with check (requester_user_id = auth.uid());

grant select on public.businesses, public.user_memberships,
  public.marketing_provider_profiles, public.marketing_leads to authenticated;
grant insert on public.marketing_leads to authenticated;
grant select, insert, update, delete on public.marketing_provider_profiles to authenticated;

insert into public.businesses(id, tenant_id, name) values
  ('30000000-0000-4000-8000-000000000001', 'TENANT-A', 'Business A1'),
  ('30000000-0000-4000-8000-000000000002', 'TENANT-A', 'Business A2'),
  ('30000000-0000-4000-8000-000000000003', 'TENANT-B', 'Business B1');

insert into public.user_memberships(id, user_id, tenant_id, business_id, role, status) values
  ('provider-a', '30000000-0000-4000-8000-000000000011', 'TENANT-A', '30000000-0000-4000-8000-000000000001', 'SERVICE_PROVIDER', 'ACTIVE'),
  ('provider-a2', '30000000-0000-4000-8000-000000000012', 'TENANT-A', '30000000-0000-4000-8000-000000000002', 'SERVICE_PROVIDER', 'ACTIVE'),
  ('provider-b', '30000000-0000-4000-8000-000000000013', 'TENANT-B', '30000000-0000-4000-8000-000000000003', 'SERVICE_PROVIDER', 'ACTIVE'),
  ('tenant-admin-null-business', '30000000-0000-4000-8000-000000000014', 'TENANT-A', null, 'ADMIN', 'ACTIVE');

insert into public.marketing_provider_profiles(
  id, business_id, owner_user_id, provider_kind, name_ar, slug, status, is_verified
) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000011', 'FREELANCER', 'Provider A', 'provider-a', 'PENDING', false),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000013', 'FREELANCER', 'Provider B', 'provider-b', 'PENDING', false),
  ('40000000-0000-4000-8000-000000000004', null, '30000000-0000-4000-8000-000000000021', 'FREELANCER', 'Legacy Owner Profile', 'legacy-owner-profile', 'ACTIVE', false);

 
-- Seed non-brand metadata to prove an owner logo update preserves it.
update public.marketing_provider_profiles
set settings = jsonb_build_object(
  'official_showcase', true,
  'managed_by', 'SUPER_ADMIN',
  'activity_code', 'HEALTH',
  'branding', jsonb_build_object(
    'logo_path', 'assets/original-provider-a.svg',
    'preserve_me', 'platform-owned'
  )
)
where id = '40000000-0000-4000-8000-000000000001';

update public.marketing_provider_profiles
set settings = jsonb_build_object(
  'managed_by', 'PLATFORM',
  'branding', jsonb_build_object('logo_path', 'assets/original-legacy.svg')
)
where id = '40000000-0000-4000-8000-000000000004';
