
create table if not exists public.restaurant_orders (
 id text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 customer_name text not null,
 customer_phone text not null,
 fulfillment_type text not null,
 table_number integer,
 items jsonb not null default '[]'::jsonb,
 subtotal_egp numeric(14,2) not null,
 tax_egp numeric(14,2) not null default 0,
 delivery_fee_egp numeric(14,2) not null default 0,
 discount_egp numeric(14,2) not null default 0,
 total_egp numeric(14,2) not null,
 status text not null default 'NEW',
 notes_from_customer text not null default '',
 driver_name text,
 driver_phone text,
 delivery_pin_code text not null default '',
 delivery_address text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.restaurant_tables (
 id text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 table_number integer not null,
 capacity_persons integer not null default 2,
 status text not null default 'EMPTY',
 current_active_order_id text,
 current_bill_egp numeric(14,2) not null default 0,
 reserved_customer_name text,
 unique(owner_user_id, table_number)
);
create table if not exists public.restaurant_inventory (
 id text primary key,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name_ar text not null,
 unit text not null,
 current_stock_qty numeric(14,3) not null default 0,
 min_stock_alert_threshold numeric(14,3) not null default 0,
 unit_cost_egp numeric(14,2) not null default 0,
 supplier_name text not null default '',
 updated_at timestamptz not null default now()
);
alter table public.restaurant_orders enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.restaurant_inventory enable row level security;
create policy restaurant_orders_select on public.restaurant_orders for select to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_orders_insert on public.restaurant_orders for insert to authenticated with check (owner_user_id=auth.uid());
create policy restaurant_orders_update on public.restaurant_orders for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_orders_delete on public.restaurant_orders for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_tables_select on public.restaurant_tables for select to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_tables_insert on public.restaurant_tables for insert to authenticated with check (owner_user_id=auth.uid());
create policy restaurant_tables_update on public.restaurant_tables for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_tables_delete on public.restaurant_tables for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_inventory_select on public.restaurant_inventory for select to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_inventory_insert on public.restaurant_inventory for insert to authenticated with check (owner_user_id=auth.uid());
create policy restaurant_inventory_update on public.restaurant_inventory for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
create policy restaurant_inventory_delete on public.restaurant_inventory for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
grant select,insert,update,delete on public.restaurant_orders, public.restaurant_tables, public.restaurant_inventory to authenticated;
