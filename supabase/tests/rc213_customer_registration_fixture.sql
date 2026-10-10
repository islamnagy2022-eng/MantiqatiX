-- Disposable fixture for RC213 customer registration activation tests.
create extension if not exists pgcrypto;
create schema if not exists private;
create table public.tenants(id varchar primary key,status varchar not null);
create table public.user_memberships(
  id varchar primary key,user_id uuid not null,tenant_id varchar not null,organization_id varchar,
  role varchar not null,permissions jsonb not null default '{}'::jsonb,status varchar not null,
  created_at timestamptz not null default now()
);
create unique index user_memberships_customer_active_test_uidx
  on public.user_memberships(user_id,tenant_id,role) where status='ACTIVE' and upper(role)='CUSTOMER';
create table public.account_registration_requests(
  id uuid primary key default gen_random_uuid(),user_id uuid not null,requested_role varchar not null,
  status varchar not null,updated_at timestamptz not null default now()
);
create table public.audit_logs(
  id varchar primary key,tenant_id varchar,organization_id varchar,actor_user_id uuid not null,action varchar not null,
  entity_type varchar not null,entity_id varchar not null,old_values jsonb,new_values jsonb,result varchar not null
);
