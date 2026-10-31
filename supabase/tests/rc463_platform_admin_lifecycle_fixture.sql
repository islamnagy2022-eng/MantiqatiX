-- RC463 disposable PostgreSQL fixture. Never run against Production.
create extension if not exists pgcrypto;

do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

create schema if not exists auth;
create schema if not exists private;

create table auth.users (
  id uuid primary key,
  email_confirmed_at timestamptz,
  is_anonymous boolean not null default false,
  banned_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.platform_admins enable row level security;
alter table private.platform_admins force row level security;
revoke all on schema private from public, anon, authenticated;
revoke all on table private.platform_admins from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, delete on table private.platform_admins to service_role;

create table public.tenants (
  id varchar primary key,
  name varchar not null,
  code varchar not null unique,
  status varchar not null default 'ACTIVE',
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null references auth.users(id),
  tenant_id varchar not null references public.tenants(id),
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  permissions jsonb,
  status varchar not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

insert into public.tenants(id,name,code,status,settings)
values ('MNTY-PLATFORM','MNTY Platform','MNTY','ACTIVE','{}'::jsonb);

-- Root candidates, tenant owner, and an unconfirmed account.
insert into auth.users(id,email_confirmed_at,is_anonymous,banned_until,deleted_at) values
 ('10000000-0000-4000-8000-000000000001',now(),false,null,null),
 ('10000000-0000-4000-8000-000000000002',now(),false,null,null),
 ('10000000-0000-4000-8000-000000000003',now(),false,null,null),
 ('10000000-0000-4000-8000-000000000004',null,false,null,null);

insert into public.user_memberships(id,user_id,tenant_id,role,permissions,status)
values ('tenant-owner','10000000-0000-4000-8000-000000000003','MNTY-PLATFORM',
        'OWNER','{"admin":true}'::jsonb,'ACTIVE');

create table public.audit_logs (
  id varchar primary key,
  tenant_id varchar not null,
  actor_user_id uuid not null,
  action varchar not null,
  entity_type varchar not null,
  entity_id varchar not null,
  old_values jsonb default '{}'::jsonb,
  new_values jsonb default '{}'::jsonb,
  result varchar not null default 'SUCCESS',
  created_at timestamptz not null default now()
);
