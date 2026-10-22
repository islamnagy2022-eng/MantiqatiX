create extension if not exists pgcrypto;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;

create table user_memberships(
 user_id uuid not null, tenant_id varchar not null, status text, role text
);
create table businesses(id uuid primary key, tenant_id varchar not null, status text);
create table marketing_provider_profiles(business_id uuid not null, status text);
create table branches(id varchar primary key, business_id uuid not null, tenant_id varchar not null, status text);
create table catalog_business_settings(
 business_id uuid primary key, tenant_id varchar not null, currency varchar default 'EGP',
 delivery_fee numeric default 0, tax_inclusive boolean default false
);
create table catalog_items(
 id uuid primary key, tenant_id varchar not null, business_id uuid not null, status text not null,
 branch_id varchar, legacy_ref text, name_ar text not null, tax_rate numeric default 0
);
create table catalog_item_prices(
 catalog_item_id uuid not null, tenant_id varchar not null, status text not null,
 effective_from timestamptz not null, effective_to timestamptz, branch_id varchar,
 unit_price numeric not null, version bigint not null
);
create table catalog_item_options(
 id uuid primary key, catalog_item_id uuid not null, status text not null,
 price_delta numeric not null default 0, name_ar text
);
create table orders(
 id uuid primary key, tenant_id varchar not null, business_id uuid not null, branch_id varchar,
 customer_id uuid not null, status text not null, subtotal numeric not null, discount numeric not null,
 tax numeric not null, delivery_fee numeric not null, total_amount numeric not null, currency varchar not null,
 customer_name text, customer_phone text, delivery_address text, items_json jsonb, notes text, metadata jsonb,
 client_idempotency_key varchar not null, pricing_version bigint, pricing_snapshot jsonb, pricing_hash text,
 pricing_authority text, created_at timestamptz default now(), unique(tenant_id,client_idempotency_key)
);
