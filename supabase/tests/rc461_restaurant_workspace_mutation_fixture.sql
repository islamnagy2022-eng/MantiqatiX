do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$;

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$;

create table if not exists public.businesses (
  id uuid primary key,
  tenant_id varchar not null,
  status varchar not null default 'ACTIVE'
);
create table if not exists public.branches (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  status varchar not null default 'ACTIVE'
);
create table if not exists public.user_memberships (
  id text primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar not null,
  role varchar not null,
  status varchar not null default 'ACTIVE'
);
create table if not exists public.audit_logs (
  id text primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  actor_user_id uuid not null,
  action varchar not null,
  entity_type varchar not null,
  entity_id text not null,
  old_values jsonb default '{}'::jsonb,
  new_values jsonb default '{}'::jsonb,
  result varchar not null default 'SUCCESS',
  created_at timestamptz not null default now()
);

create table public.restaurant_tables (
  id text primary key,
  tenant_id text not null,
  business_id uuid not null,
  branch_id text not null,
  owner_user_id uuid not null,
  table_number integer not null,
  capacity_persons integer not null,
  status text not null,
  reserved_customer_name text,
  current_active_order_id text,
  current_bill_egp numeric not null default 0
);
create table public.restaurant_inventory (
  id text primary key,
  tenant_id text not null,
  business_id uuid not null,
  branch_id text not null,
  owner_user_id uuid not null,
  name_ar text not null,
  unit text not null,
  current_stock_qty numeric not null default 0,
  min_stock_alert_threshold numeric not null default 0,
  unit_cost_egp numeric not null default 0,
  supplier_name text,
  updated_at timestamptz not null default now()
);
alter table public.restaurant_tables enable row level security;
alter table public.restaurant_inventory enable row level security;
grant select, insert, update, delete on public.restaurant_tables, public.restaurant_inventory to authenticated;
