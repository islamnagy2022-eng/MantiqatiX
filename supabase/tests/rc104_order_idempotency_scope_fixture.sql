-- Disposable PostgreSQL fixture for RC104 idempotency ownership/scope tests.
create extension if not exists pgcrypto;
create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $;

create or replace function auth.role()
returns text language sql stable
as $ select nullif(current_setting('request.jwt.claim.role', true), '') $;

create table public.orders (
  id uuid primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  customer_id uuid not null,
  status varchar not null,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  delivery_fee numeric not null default 0,
  total_amount numeric not null default 0,
  currency varchar not null default 'EGP',
  customer_name text,
  customer_phone text,
  delivery_address text,
  items_json jsonb not null default '[]'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  client_idempotency_key varchar,
  pricing_version bigint not null default 0,
  pricing_snapshot jsonb not null default '[]'::jsonb,
  pricing_hash text,
  pricing_authority text
);
create unique index ux_orders_tenant_client_idempotency
  on public.orders(tenant_id, client_idempotency_key)
  where client_idempotency_key is not null;

create table public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id varchar not null,
  status varchar default 'ACTIVE',
  role varchar not null
);
create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null,
  status varchar not null default 'ACTIVE'
);
create table public.marketing_provider_profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  status varchar not null default 'ACTIVE'
);
create table public.branches (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  status varchar not null default 'ACTIVE'
);
create table public.catalog_business_settings (
  business_id uuid primary key,
  tenant_id varchar not null,
  currency varchar not null default 'EGP',
  delivery_fee numeric not null default 0,
  tax_inclusive boolean not null default false
);
create table public.catalog_items (
  id uuid primary key,
  legacy_ref text,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  name_ar text,
  tax_rate numeric not null default 0,
  status varchar not null default 'ACTIVE'
);
create table public.catalog_item_prices (
  catalog_item_id uuid not null,
  tenant_id varchar not null,
  branch_id varchar,
  status varchar not null default 'ACTIVE',
  unit_price numeric not null,
  version bigint not null default 1,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);
create table public.catalog_item_options (
  id uuid primary key,
  catalog_item_id uuid not null,
  status varchar not null default 'ACTIVE',
  price_delta numeric not null default 0
);

insert into public.businesses(id,tenant_id,status) values
 ('20000000-0000-4000-8000-000000000001','tenant-a','ACTIVE'),
 ('20000000-0000-4000-8000-000000000002','tenant-a','ACTIVE');
insert into public.marketing_provider_profiles(business_id,status) values
 ('20000000-0000-4000-8000-000000000001','ACTIVE'),
 ('20000000-0000-4000-8000-000000000002','ACTIVE');
insert into public.branches(id,tenant_id,business_id,status) values
 ('branch-a','tenant-a','20000000-0000-4000-8000-000000000001','ACTIVE'),
 ('branch-b','tenant-a','20000000-0000-4000-8000-000000000001','ACTIVE');
insert into public.user_memberships(user_id,tenant_id,status,role) values
 ('10000000-0000-4000-8000-000000000001','tenant-a','ACTIVE','CUSTOMER'),
 ('10000000-0000-4000-8000-000000000002','tenant-a','ACTIVE','CUSTOMER');

insert into public.orders(
 id,tenant_id,business_id,branch_id,customer_id,status,total_amount,currency,
 client_idempotency_key,pricing_version,pricing_snapshot,pricing_hash
) values (
 '30000000-0000-4000-8000-000000000001','tenant-a',
 '20000000-0000-4000-8000-000000000001','branch-a',
 '10000000-0000-4000-8000-000000000001','PENDING',125,'EGP',
 'same-key-rc104',7,'[{"catalog_item_id":"40000000-0000-4000-8000-000000000001"}]'::jsonb,'fixture-hash'
);
