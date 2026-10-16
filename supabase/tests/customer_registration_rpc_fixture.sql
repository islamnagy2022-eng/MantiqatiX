create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$$;

create schema if not exists private;
create schema if not exists auth;

create table public.tenants (
  id varchar primary key,
  status varchar not null
);
insert into public.tenants(id, status) values
  ('MNTY-PLATFORM', 'ACTIVE'),
  ('MNTY-INACTIVE-TEST', 'INACTIVE');

create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  organization_id varchar,
  business_id varchar,
  branch_id varchar,
  role varchar not null,
  permissions jsonb not null default '{}'::jsonb,
  status varchar not null,
  created_at timestamptz default now()
);

create table public.account_registration_requests (
  id varchar primary key,
  user_id uuid not null,
  requested_role varchar not null,
  status varchar not null,
  updated_at timestamptz default now()
);

create table public.audit_logs (
  id varchar primary key,
  tenant_id varchar,
  organization_id varchar,
  actor_user_id uuid,
  action varchar not null,
  entity_type varchar,
  entity_id varchar,
  old_values jsonb,
  new_values jsonb,
  result varchar
);

create table auth.users (
  id uuid primary key,
  is_anonymous boolean default false
);
