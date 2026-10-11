do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$$;

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
  id uuid primary key default gen_random_uuid(),
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
grant select, insert, update, delete on public.restaurant_tables, public.restaurant_inventory to authenticated;
