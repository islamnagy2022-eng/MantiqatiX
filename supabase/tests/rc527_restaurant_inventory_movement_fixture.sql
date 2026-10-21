\set ON_ERROR_STOP on
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then execute 'create role anon nologin'; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then execute 'create role authenticated nologin'; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.user_memberships (
  id text primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar not null,
  role varchar not null,
  status varchar not null,
  created_at timestamptz not null default now()
);
create table public.restaurant_inventory (
  id text primary key,
  owner_user_id uuid not null,
  name_ar text not null,
  unit text not null,
  current_stock_qty numeric not null,
  min_stock_alert_threshold numeric not null default 0,
  unit_cost_egp numeric not null default 0,
  supplier_name text not null default '',
  updated_at timestamptz not null default now(),
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar not null
);
grant select on public.restaurant_inventory to authenticated;

insert into public.user_memberships (id,user_id,tenant_id,business_id,branch_id,role,status) values
('m-owner','10000000-0000-0000-0000-000000000001','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','OWNER','ACTIVE'),
('m-staff','10000000-0000-0000-0000-000000000002','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','STAFF','ACTIVE'),
('m-outsider','10000000-0000-0000-0000-000000000003','tenant-b','20000000-0000-0000-0000-000000000002','branch-b','OWNER','ACTIVE');

insert into public.restaurant_inventory
(id,owner_user_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name,tenant_id,business_id,branch_id) values
('item-a','10000000-0000-0000-0000-000000000001','مخزون اختبار A','KG',10,2,4,'','tenant-a','20000000-0000-0000-0000-000000000001','branch-a'),
('item-empty','10000000-0000-0000-0000-000000000001','مخزون افتتاحي','KG',0,1,0,'','tenant-a','20000000-0000-0000-0000-000000000001','branch-a'),
('item-b','10000000-0000-0000-0000-000000000003','مخزون اختبار B','KG',10,2,4,'','tenant-b','20000000-0000-0000-0000-000000000002','branch-b');
