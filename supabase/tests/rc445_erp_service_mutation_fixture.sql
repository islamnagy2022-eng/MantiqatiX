-- RC445 disposable PostgreSQL fixture. Never run this fixture against a production database.
do $roles$
begin create role anon; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role authenticated; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role service_role; exception when duplicate_object then null; end
$roles$;

create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  status varchar not null default 'ACTIVE'
);
create table public.erp_purchase_orders (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  order_number varchar not null,
  supplier_id varchar not null,
  total_amount numeric not null default 0,
  tax_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  status varchar not null default 'DRAFT',
  reason text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.warehouses (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  name varchar not null,
  code varchar not null,
  status varchar not null default 'ACTIVE',
  created_at timestamptz not null default now()
);
create table public.catalog_items (
  id uuid primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  item_type varchar not null default 'PRODUCT',
  name_ar text not null,
  status varchar not null default 'ACTIVE'
);
create table public.erp_stock_transfers (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  transfer_number varchar not null,
  from_warehouse_id varchar not null,
  to_warehouse_id varchar not null,
  product_id uuid not null,
  quantity numeric not null,
  status varchar not null default 'REQUESTED',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,transfer_number)
);
create table public.stock_balances (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  warehouse_id varchar not null,
  product_id uuid not null,
  quantity_on_hand numeric not null default 0,
  quantity_reserved numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id,business_id,warehouse_id,product_id)
);
create table public.inventory_transactions (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  warehouse_id varchar,
  product_id uuid not null,
  transaction_type varchar not null,
  quantity numeric not null,
  unit_cost numeric not null default 0,
  reference_id varchar,
  created_by uuid,
  created_at timestamptz not null default now()
);
