-- Disposable PostgreSQL fixture for RC215 customer membership invariant integration tests.
-- This fixture is isolated to the CI service container; it is not a production schema migration.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema private;

create table auth.users (
  id uuid primary key,
  is_anonymous boolean not null default false
);

create table public.tenants (
  id varchar primary key,
  status varchar not null
);

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
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  actor_user_id uuid,
  action varchar not null,
  entity_type varchar not null,
  entity_id varchar,
  old_values jsonb,
  new_values jsonb,
  result varchar not null,
  created_at timestamptz not null default now()
);

insert into public.tenants(id, status) values
  ('MNTY-PLATFORM', 'ACTIVE'),
  ('MNTY-INACTIVE-TEST', 'INACTIVE');
