create extension if not exists pgcrypto;
create schema if not exists private;
do $roles$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;

create table public.tenants(id varchar primary key,status varchar not null);
create table public.organizations(id varchar primary key,tenant_id varchar not null);
create table public.businesses(
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null,
  organization_id varchar,
  name varchar not null,
  code varchar not null,
  status varchar not null default 'INACTIVE',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(tenant_id,code)
);
create table public.user_memberships(
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  permissions jsonb not null default '{}'::jsonb,
  status varchar not null,
  created_at timestamptz not null default now()
);
create table public.approval_requests(
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  request_type varchar not null,
  entity_type varchar not null,
  entity_id varchar not null,
  requested_by uuid not null,
  status varchar not null,
  priority varchar not null default 'NORMAL',
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.tenants(id,status) values
 ('TENANT-A','ACTIVE'),('TENANT-B','ACTIVE'),('TENANT-INACTIVE','INACTIVE'),('MNTY-PLATFORM','ACTIVE');
insert into public.organizations(id,tenant_id) values ('ORG-A','TENANT-A'),('ORG-B','TENANT-B');
insert into public.user_memberships(id,user_id,tenant_id,organization_id,role,permissions,status) values
 ('MEM-A','10000000-0000-4000-8000-000000000001','TENANT-A','ORG-A','OWNER','{}','ACTIVE'),
 ('MEM-B','10000000-0000-4000-8000-000000000002','TENANT-B','ORG-B','OWNER','{}','ACTIVE'),
 ('MEM-C','10000000-0000-4000-8000-000000000003','TENANT-A','ORG-A','OWNER','{}','ACTIVE'),
 ('MEM-PLATFORM','10000000-0000-4000-8000-000000000004','MNTY-PLATFORM',null,'SUPER_ADMIN','{"scope":"PLATFORM","full_control":true}','ACTIVE');
