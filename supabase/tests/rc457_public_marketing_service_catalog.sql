-- RC457 public service-catalog view regression; disposable PostgreSQL only.
begin;

create role anon nologin;
create role authenticated nologin;

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
create policy test_active_admin_policy on public.marketing_services
for select to authenticated using (true);

insert into public.marketing_services
  (id,code,name_ar,category_code,status,internal_notes)
values
  ('10000000-0000-4000-8000-000000000001','PUBLIC-A','خدمة منشورة','FOOD','ACTIVE','must-not-leak'),
  ('10000000-0000-4000-8000-000000000002','PRIVATE-D','مسودة داخلية','FOOD','DRAFT','private');

\i supabase/migrations/20261019090000_rc457_public_marketing_service_catalog.sql

set role anon;
do $assert$
declare visible_count integer;
begin
  select count(*) into visible_count from public.marketing_services_public;
  if visible_count <> 1 then
    raise exception 'RC457 expected exactly one public ACTIVE service, got %', visible_count;
  end if;
  if not exists (select 1 from public.marketing_services_public where code='PUBLIC-A') then
    raise exception 'RC457 active public service is not visible';
  end if;
  begin
    perform internal_notes from public.marketing_services;
    raise exception 'RC457 base table unexpectedly readable by anon';
  exception when insufficient_privilege then null;
  end;
end;
$assert$;
reset role;

set role authenticated;
do $assert$
declare visible_count integer;
begin
  select count(*) into visible_count from public.marketing_services_public;
  if visible_count <> 1 then
    raise exception 'RC457 authenticated public view expected one row, got %', visible_count;
  end if;
end;
$assert$;
reset role;
rollback;
