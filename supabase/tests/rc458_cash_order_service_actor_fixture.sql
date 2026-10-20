\\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema auth to service_role,authenticated,anon;
grant usage on schema public to service_role,authenticated,anon;

create table public.user_memberships(user_id uuid not null,tenant_id varchar not null,status varchar not null default 'ACTIVE',role varchar not null);
create table public.businesses(id uuid primary key,tenant_id varchar not null,status varchar not null);
create table public.marketing_provider_profiles(id uuid primary key default gen_random_uuid(),business_id uuid not null,status varchar not null);
create table public.branches(id varchar primary key,business_id uuid not null,tenant_id varchar not null,status varchar not null);
create table public.catalog_business_settings(business_id uuid primary key,tenant_id varchar not null,currency varchar,delivery_fee numeric not null default 0,tax_inclusive boolean not null default true);
create table public.catalog_items(id uuid primary key,tenant_id varchar not null,business_id uuid not null,branch_id varchar,legacy_ref varchar,name_ar text,status varchar not null,tax_rate numeric not null default 0);
create table public.catalog_item_prices(id uuid primary key default gen_random_uuid(),catalog_item_id uuid not null,tenant_id varchar not null,branch_id varchar,status varchar not null,effective_from timestamptz not null,effective_to timestamptz,unit_price numeric not null,version bigint not null);
create table public.catalog_item_options(id uuid primary key default gen_random_uuid(),catalog_item_id uuid not null,price_delta numeric not null default 0,status varchar not null);
create table public.orders(
 id uuid primary key,tenant_id varchar not null,business_id uuid not null,branch_id varchar,customer_id uuid not null,status varchar not null,
 subtotal numeric not null,discount numeric not null,tax numeric not null,delivery_fee numeric not null,total_amount numeric not null,total numeric,
 currency varchar not null,customer_name text not null,customer_phone text not null,delivery_address text not null,items_json jsonb not null,
 notes text,metadata jsonb not null,client_idempotency_key varchar not null,pricing_version bigint not null,pricing_snapshot jsonb not null,
 pricing_hash text not null,pricing_authority text not null,created_at timestamptz not null default now(),
 unique(tenant_id,client_idempotency_key)
);
insert into public.user_memberships(user_id,tenant_id,status,role) values
 ('11111111-1111-4111-8111-111111111111','tenant-a','ACTIVE','CUSTOMER');
insert into public.businesses(id,tenant_id,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','ACTIVE');
insert into public.marketing_provider_profiles(business_id,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ACTIVE');
insert into public.catalog_business_settings(business_id,tenant_id,currency,delivery_fee,tax_inclusive) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','EGP',0,true);
insert into public.catalog_items(id,tenant_id,business_id,branch_id,legacy_ref,name_ar,status,tax_rate) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,'item-1','خدمة اختبار','ACTIVE',0);
insert into public.catalog_item_prices(catalog_item_id,tenant_id,branch_id,status,effective_from,effective_to,unit_price,version) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','tenant-a',null,'ACTIVE',now()-interval '1 day',null,125.50,1);

create function public.create_order_backend(
 p_order_id uuid,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_customer_id uuid,
 p_client_idempotency_key varchar,p_subtotal numeric,p_discount numeric,p_tax numeric,p_delivery_fee numeric,
 p_total_amount numeric,p_currency varchar,p_customer_name text,p_customer_phone text,p_delivery_address text,
 p_items_json jsonb,p_notes text default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language sql as $$ select '{}'::jsonb $$;
revoke all on function public.create_order_backend(uuid,varchar,uuid,varchar,uuid,varchar,numeric,numeric,numeric,numeric,numeric,varchar,text,text,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_order_backend(uuid,varchar,uuid,varchar,uuid,varchar,numeric,numeric,numeric,numeric,numeric,varchar,text,text,text,jsonb,text,jsonb) to service_role;
