\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then execute 'create role anon nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then execute 'create role authenticated nologin'; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.jwt()
returns jsonb language sql stable
as $$ select jsonb_build_object('sub',nullif(current_setting('request.jwt.claim.sub',true),''),'is_anonymous',false) $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;

create table public.user_memberships (
 id text primary key,user_id uuid not null,tenant_id varchar not null,business_id uuid not null,
 branch_id varchar not null,role varchar not null,status varchar not null,created_at timestamptz not null default now()
);
grant select on public.user_memberships to authenticated;

create table public.restaurant_tables (
 id text primary key,owner_user_id uuid not null,table_number integer not null,capacity_persons integer not null,
 status text not null,current_active_order_id text,current_bill_egp numeric not null default 0,
 reserved_customer_name text,tenant_id varchar not null,business_id uuid not null,branch_id varchar not null
);
grant select on public.restaurant_tables to authenticated;

insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status) values
 ('owner-a','10000000-0000-0000-0000-000000000001','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','OWNER','ACTIVE'),
 ('staff-a','10000000-0000-0000-0000-000000000002','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','STAFF','ACTIVE'),
 ('owner-b','10000000-0000-0000-0000-000000000003','tenant-b','20000000-0000-0000-0000-000000000002','branch-b','OWNER','ACTIVE');
insert into public.restaurant_tables(id,owner_user_id,table_number,capacity_persons,status,current_bill_egp,tenant_id,business_id,branch_id) values
 ('table-a','10000000-0000-0000-0000-000000000001',1,4,'EMPTY',0,'tenant-a','20000000-0000-0000-0000-000000000001','branch-a'),
 ('table-b','10000000-0000-0000-0000-000000000003',1,2,'EMPTY',0,'tenant-b','20000000-0000-0000-0000-000000000002','branch-b');
