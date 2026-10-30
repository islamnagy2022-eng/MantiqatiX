-- Additional non-journal objects required to run RC450 after RC449A in the same disposable PostgreSQL database.
create extension if not exists pgcrypto;
create schema if not exists auth;

do $roles$
begin
  create role anon;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role;
exception when duplicate_object then null;
end
$roles$;

create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create or replace function auth.role()
returns text language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$function$;

create table public.user_memberships (
  user_id uuid not null,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  status varchar not null
);

create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null,
  organization_id varchar,
  status varchar not null
);

create table public.branches (
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid not null,
  status varchar not null
);

insert into public.businesses(id,tenant_id,organization_id,status) values
 ('20000000-0000-4000-8000-000000000564','tenant-a','org-a','ACTIVE'),
 ('20000000-0000-4000-8000-000000000566','tenant-a','org-a','ACTIVE'),
 ('20000000-0000-4000-8000-000000000565','tenant-b','org-b','ACTIVE');

insert into public.branches(id,tenant_id,organization_id,business_id,status) values
 ('branch-a','tenant-a',null,'20000000-0000-4000-8000-000000000564','ACTIVE'),
 ('branch-b','tenant-a',null,'20000000-0000-4000-8000-000000000564','ACTIVE');

create table public.chart_of_accounts (
  id varchar primary key,
  tenant_id varchar not null,
  is_active boolean not null default true
);
