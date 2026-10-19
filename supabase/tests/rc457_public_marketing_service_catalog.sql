-- RC457 public service-catalog RLS regression.
-- Run only in a disposable PostgreSQL database.
begin;

create role anon nologin;
create role authenticated nologin;

create table public.marketing_provider_profiles (
  id uuid primary key,
  business_id uuid,
  owner_user_id uuid,
  name_ar text not null,
  name_en text,
  provider_kind text not null,
  description text,
  service_areas jsonb,
  status text not null,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  ranking_weight integer not null default 0,
  profile_image_path text,
  updated_at timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb
);
alter table public.marketing_provider_profiles enable row level security;
create policy marketing_provider_profiles_public_active_read
on public.marketing_provider_profiles for select to anon using (status='ACTIVE');
grant select on public.marketing_provider_profiles to anon, authenticated;
insert into public.marketing_provider_profiles
  (id,business_id,owner_user_id,name_ar,provider_kind,status,settings)
values
  ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','مقدم منشور','FOOD','ACTIVE','{"private_api_key":"must-not-leak"}'),
  ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','مقدم مسودة','FOOD','DRAFT','{"private_api_key":"private"}');

create table public.marketing_services (
  id uuid primary key,
  code text not null,
  name_ar text not null,
  name_en text,
  category_code text not null,
  description text,
  status text not null,
  created_at timestamptz not null default now(),
  internal_notes text
);
alter table public.marketing_services enable row level security;
grant select on public.marketing_services to anon, authenticated;

insert into public.marketing_services
  (id,code,name_ar,category_code,status,internal_notes)
values
  ('10000000-0000-4000-8000-000000000001','PUBLIC-A','خدمة منشورة','FOOD','ACTIVE','must-not-leak'),
  ('10000000-0000-4000-8000-000000000002','PRIVATE-D','مسودة داخلية','FOOD','DRAFT','private');

\i supabase/migrations/20261019090000_rc457_public_marketing_service_catalog.sql

set role anon;
do $assert$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.marketing_services;
  if visible_count <> 1 then
    raise exception 'RC457 expected exactly one public ACTIVE service, got %', visible_count;
  end if;
  if not exists (
    select 1 from public.marketing_services
    where code='PUBLIC-A' and status='ACTIVE'
  ) then
    raise exception 'RC457 active public service is not visible';
  end if;
  begin
    perform internal_notes from public.marketing_services;
    raise exception 'RC457 private internal_notes column unexpectedly readable by anon';
  exception when insufficient_privilege then
    null;
  end;
end;
$assert$;
reset role;

rollback;
