\set ON_ERROR_STOP on
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin; exception when duplicate_object then null; end $$;
create schema auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema auth to authenticated,anon,service_role;
grant usage on schema public to authenticated,anon,service_role;

create table public.orders(
 id uuid primary key,tenant_id varchar not null,business_id uuid,customer_id uuid,status varchar,total_amount numeric,total numeric,currency varchar,
 pricing_version bigint,pricing_hash text,pricing_authority text
);
create table public.payment_intents(
 id varchar primary key,tenant_id varchar not null,order_id uuid not null,amount numeric not null,currency varchar not null,status varchar not null,
 provider varchar not null,payment_method varchar not null,idempotency_key varchar not null,pricing_version bigint,pricing_hash text
);
insert into public.orders(id,tenant_id,business_id,customer_id,status,total_amount,total,currency,pricing_version,pricing_hash,pricing_authority)
values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','PENDING',100,100,'EGP',1,'pricing-hash','catalog_v1');

create function public.create_payment_intent_backend(
 p_tenant_id character varying,p_order_id uuid,p_amount numeric,p_currency character varying,
 p_provider character varying,p_payment_method character varying,p_idempotency_key character varying
) returns jsonb language sql as $$ select '{}'::jsonb $$;
revoke all on function public.create_payment_intent_backend(varchar,uuid,numeric,varchar,varchar,varchar,varchar) from public,anon;
grant execute on function public.create_payment_intent_backend(varchar,uuid,numeric,varchar,varchar,varchar,varchar) to authenticated,service_role;
