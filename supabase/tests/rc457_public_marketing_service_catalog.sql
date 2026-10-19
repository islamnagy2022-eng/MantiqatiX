-- RC457 public service-catalog view regression; disposable PostgreSQL only.
begin;

create role anon nologin;
create role authenticated nologin;

create table public.businesses (
  id uuid primary key,
  status text not null default 'ACTIVE',
  settings jsonb not null default '{}'::jsonb
);
insert into public.businesses (id,status,settings) values
  ('30000000-0000-4000-8000-000000000001','ACTIVE','{"showcase":true}'),
  ('30000000-0000-4000-8000-000000000002','ACTIVE','{"showcase":false}'),
  ('30000000-0000-4000-8000-000000000003','INACTIVE','{"showcase":true}');

create table public.marketing_provider_profiles (
  id uuid primary key,
  business_id uuid,
  owner_user_id uuid,
  name_ar text not null,
  name_en text,
  provider_kind text not null,
  description text,
  service_areas jsonb not null default '[]'::jsonb,
  status text not null,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  ranking_weight integer not null default 0,
  profile_image_path text,
  updated_at timestamptz not null default now(),
  settings jsonb not null default '{}'::jsonb,
  portfolio jsonb not null default '[]'::jsonb
);
alter table public.marketing_provider_profiles enable row level security;
grant select on public.marketing_provider_profiles to anon, authenticated;
-- Simulate legacy column-level grants that table-level REVOKE alone would leave behind.
grant select (owner_user_id, settings, portfolio, ranking_weight) on public.marketing_provider_profiles to anon;
create policy provider_owner_private_profile_read
  on public.marketing_provider_profiles
  for select to authenticated
  using (owner_user_id::text = current_setting('request.jwt.claim.sub', true));
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
grant select (internal_notes) on public.marketing_services to anon;

insert into public.marketing_provider_profiles
  (id,business_id,name_ar,provider_kind,status,owner_user_id,settings,portfolio)
values
  ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','مقدم منشور','AGENCY','ACTIVE','30000000-0000-4000-8000-000000000001','{"secret":"must-not-leak"}','["private-portfolio"]'),
  ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','مسودة مقدم','AGENCY','DRAFT','30000000-0000-4000-8000-000000000002','{"secret":"private"}','["draft"]'),
  ('20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','مقدم دون عرض عام','AGENCY','ACTIVE','30000000-0000-4000-8000-000000000003','{"secret":"private"}','["private"]'),
  ('20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','مقدم لنشاط غير نشط','AGENCY','ACTIVE','30000000-0000-4000-8000-000000000004','{"secret":"private"}','["private"]');

insert into public.marketing_services
  (id,code,name_ar,category_code,status,internal_notes)
values
  ('10000000-0000-4000-8000-000000000001','PUBLIC-A','خدمة منشورة','FOOD','ACTIVE','must-not-leak'),
  ('10000000-0000-4000-8000-000000000002','PRIVATE-D','مسودة داخلية','FOOD','DRAFT','private');

\i supabase/migrations/20261019090000_rc457_public_marketing_service_catalog.sql
\i supabase/migrations/20261019100000_rc458_public_provider_profile_column_allowlist.sql

set role anon;
do $assert$
declare visible_count integer;
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='marketing_services_public'
      and coalesce(c.reloptions, array[]::text[]) @> array['security_barrier=true']
  ) then
    raise exception 'RC457 public service view must retain security_barrier=true';
  end if;
  select count(*) into visible_count from public.marketing_services_public;
  if visible_count <> 1 then
    raise exception 'RC457 expected exactly one public ACTIVE service, got %', visible_count;
  end if;
  if not exists (select 1 from public.marketing_services_public where code='PUBLIC-A') then
    raise exception 'RC457 active public service is not visible';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='marketing_services_public'
      and column_name in ('internal_notes')
  ) then
    raise exception 'RC457 public view exposes an internal service column';
  end if;
  if (select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns
      where table_schema='public' and table_name='marketing_services_public')
      <> 'id,code,name_ar,name_en,category_code,description,status,created_at' then
    raise exception 'RC457 public service view column allowlist changed unexpectedly';
  end if;
  if has_table_privilege('anon','public.marketing_services_public','INSERT')
     or has_table_privilege('anon','public.marketing_services_public','UPDATE')
     or has_table_privilege('anon','public.marketing_services_public','DELETE')
     or has_table_privilege('authenticated','public.marketing_services_public','INSERT')
     or has_table_privilege('authenticated','public.marketing_services_public','UPDATE')
     or has_table_privilege('authenticated','public.marketing_services_public','DELETE') then
    raise exception 'RC457 public service view unexpectedly grants write privileges';
  end if;
  if not has_table_privilege('anon','public.marketing_services_public','SELECT')
     or not has_table_privilege('authenticated','public.marketing_services_public','SELECT') then
    raise exception 'RC457 public service view must grant SELECT to anon and authenticated';
  end if;
  if has_table_privilege('anon','public.marketing_services_public','TRUNCATE')
     or has_table_privilege('anon','public.marketing_services_public','REFERENCES')
     or has_table_privilege('anon','public.marketing_services_public','TRIGGER')
     or has_table_privilege('authenticated','public.marketing_services_public','TRUNCATE')
     or has_table_privilege('authenticated','public.marketing_services_public','REFERENCES')
     or has_table_privilege('authenticated','public.marketing_services_public','TRIGGER') then
    raise exception 'RC457 public service view grants a non-SELECT privilege';
  end if;
  if has_column_privilege('anon','public.marketing_services','internal_notes','SELECT') then
    raise exception 'RC457 anonymous column-level SELECT grant survived migration';
  end if;
  if has_column_privilege('anon','public.marketing_provider_profiles','settings','SELECT')
     or has_column_privilege('anon','public.marketing_provider_profiles','owner_user_id','SELECT')
     or has_column_privilege('anon','public.marketing_provider_profiles','portfolio','SELECT')
     or has_column_privilege('anon','public.marketing_provider_profiles','ranking_weight','SELECT') then
    raise exception 'RC458 anonymous private-column SELECT grant survived migration';
  end if;
  begin
    perform internal_notes from public.marketing_services;
    raise exception 'RC457 base table unexpectedly readable by anon';
  exception when insufficient_privilege then null;
  end;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='marketing_provider_profiles_public'
      and coalesce(c.reloptions, array[]::text[]) @> array['security_barrier=true']
  ) then
    raise exception 'RC458 public provider view must retain security_barrier=true';
  end if;
  select count(*) into visible_count from public.marketing_provider_profiles_public;
  if visible_count <> 1 then
    raise exception 'RC458 expected exactly one public ACTIVE provider, got %', visible_count;
  end if;
  if not exists (select 1 from public.marketing_provider_profiles_public where name_ar='مقدم منشور') then
    raise exception 'RC458 active showcased provider is not visible';
  end if;
  if exists (select 1 from public.marketing_provider_profiles_public where name_ar in ('مقدم دون عرض عام','مقدم لنشاط غير نشط')) then
    raise exception 'RC458 exposed a provider without business showcase consent or with an inactive business';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='marketing_provider_profiles_public'
      and column_name in ('owner_user_id','settings','portfolio','ranking_weight')
  ) then
    raise exception 'RC458 public view exposes private provider profile columns';
  end if;
  if (select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns
      where table_schema='public' and table_name='marketing_provider_profiles_public')
      <> 'id,business_id,name_ar,name_en,provider_kind,description,service_areas,status,is_verified,is_featured,profile_image_path,updated_at' then
    raise exception 'RC458 public provider view column allowlist changed unexpectedly';
  end if;
  if has_table_privilege('anon','public.marketing_provider_profiles_public','INSERT')
     or has_table_privilege('anon','public.marketing_provider_profiles_public','UPDATE')
     or has_table_privilege('anon','public.marketing_provider_profiles_public','DELETE')
     or has_table_privilege('authenticated','public.marketing_provider_profiles_public','INSERT')
     or has_table_privilege('authenticated','public.marketing_provider_profiles_public','UPDATE')
     or has_table_privilege('authenticated','public.marketing_provider_profiles_public','DELETE') then
    raise exception 'RC458 public provider view unexpectedly grants write privileges';
  end if;
  if not has_table_privilege('anon','public.marketing_provider_profiles_public','SELECT')
     or not has_table_privilege('authenticated','public.marketing_provider_profiles_public','SELECT') then
    raise exception 'RC458 public provider view must grant SELECT to anon and authenticated';
  end if;
  if has_table_privilege('anon','public.marketing_provider_profiles_public','TRUNCATE')
     or has_table_privilege('anon','public.marketing_provider_profiles_public','REFERENCES')
     or has_table_privilege('anon','public.marketing_provider_profiles_public','TRIGGER')
     or has_table_privilege('authenticated','public.marketing_provider_profiles_public','TRUNCATE')
     or has_table_privilege('authenticated','public.marketing_provider_profiles_public','REFERENCES')
     or has_table_privilege('authenticated','public.marketing_provider_profiles_public','TRIGGER') then
    raise exception 'RC458 public provider view grants a non-SELECT privilege';
  end if;
  begin
    perform owner_user_id from public.marketing_provider_profiles;
    raise exception 'RC458 provider base table unexpectedly readable by anon';
  exception when insufficient_privilege then null;
  end;
end;
$assert$;
reset role;

set role authenticated;
do $assert$
declare visible_count integer;
begin
  perform set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
  select count(*) into visible_count from public.marketing_provider_profiles
  where owner_user_id='30000000-0000-4000-8000-000000000001' and settings->>'secret'='must-not-leak';
  if visible_count <> 1 then
    raise exception 'RC458 owner could not read own private provider profile under existing RLS';
  end if;
  perform set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000099',true);
  select count(*) into visible_count from public.marketing_provider_profiles;
  if visible_count <> 0 then
    raise exception 'RC458 unrelated authenticated user read another provider base row';
  end if;
  select count(*) into visible_count from public.marketing_services_public;
  if visible_count <> 1 then
    raise exception 'RC457 authenticated public view expected one row, got %', visible_count;
  end if;
  select count(*) into visible_count from public.marketing_services;
  if visible_count <> 0 then
    raise exception 'RC457 authenticated direct base-table read unexpectedly exposed % rows', visible_count;
  end if;
  select count(*) into visible_count from public.marketing_provider_profiles_public;
  if visible_count <> 1 then
    raise exception 'RC458 authenticated public provider view expected one row, got %', visible_count;
  end if;
  select count(*) into visible_count from public.marketing_provider_profiles;
  if visible_count <> 0 then
    raise exception 'RC458 authenticated direct provider base-table read unexpectedly exposed % rows', visible_count;
  end if;
end;
$assert$;
reset role;
rollback;
