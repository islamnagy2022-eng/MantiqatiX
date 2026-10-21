\set ON_ERROR_STOP on
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to service_role,authenticated,anon;
grant usage on schema public to service_role,authenticated,anon;

create table public.orders(
 id uuid primary key,tenant_id varchar not null,business_id uuid not null,customer_id uuid not null,status varchar not null,
 total_amount numeric not null,total numeric not null,currency varchar not null,pricing_hash text not null,pricing_version bigint not null,pricing_authority text not null
);
create table public.payment_intents(
 id uuid primary key,tenant_id varchar not null,order_id uuid not null,amount numeric not null,currency varchar not null,status varchar not null,
 provider varchar not null,payment_method varchar not null,pricing_version bigint not null,pricing_hash text not null,updated_at timestamptz not null default now()
);
create table public.user_memberships(user_id uuid not null,tenant_id varchar not null,business_id uuid,role varchar not null,permissions jsonb,status varchar not null);
create table public.tenant_payment_methods(tenant_id varchar not null,payment_method varchar not null,provider varchar not null,is_enabled boolean not null);
create table public.commission_rules(id uuid primary key,tenant_id varchar not null,business_id uuid,active boolean not null,rule_type varchar not null,percentage numeric,fixed_amount numeric,per_item_amount numeric,updated_at timestamptz not null default now());
create table public.payment_events(id uuid primary key,tenant_id varchar not null,event_id text not null unique,payment_id text not null,amount numeric not null,payment_method varchar not null,status varchar not null,raw_payload jsonb not null,created_at timestamptz not null default now());
create table public.financial_obligations(id text primary key,tenant_id varchar not null,business_id uuid not null,order_id uuid not null,payment_intent_id text not null,beneficiary_type varchar not null,beneficiary_id varchar not null,obligation_type varchar not null,gross_amount numeric not null,amount numeric not null,currency varchar not null,status varchar not null,payment_method varchar not null,metadata jsonb not null);

insert into public.orders values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','PENDING',100,99,'EGP','price-hash',1,'catalog_v1');
insert into public.payment_intents(id,tenant_id,order_id,amount,currency,status,provider,payment_method,pricing_version,pricing_hash)
values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','tenant-a','dddddddd-dddd-4ddd-8ddd-dddddddddddd',100,'EGP','CREATED','CASH_ON_DELIVERY','CASH_ON_DELIVERY',1,'price-hash');
insert into public.tenant_payment_methods values('tenant-a','CASH_ON_DELIVERY','CASH_ON_DELIVERY',true);
insert into public.commission_rules(id,tenant_id,business_id,active,rule_type,percentage,fixed_amount,per_item_amount)
values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'PERCENTAGE',10,0,0);
insert into public.user_memberships(user_id,tenant_id,business_id,role,permissions,status) values
('22222222-2222-4222-8222-222222222222','tenant-a','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','CASHIER','{}','ACTIVE');

create function public.confirm_cash_payment(p_payment_intent_id character varying,p_user_id uuid) returns jsonb language sql as $$ select '{}'::jsonb $$;
revoke all on function public.confirm_cash_payment(character varying,uuid) from public,anon,authenticated;
grant execute on function public.confirm_cash_payment(character varying,uuid) to service_role;
