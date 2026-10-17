-- Disposable fixture for RC434 ERP receiving integration tests.
create extension if not exists pgcrypto;

create table public.user_memberships (
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid,
  role varchar not null,
  status varchar not null
);
create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null,
  status varchar not null
);
create table public.warehouses (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  status varchar not null
);
create table public.catalog_items (
  id uuid primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  status varchar not null
);
create table public.erp_purchase_orders (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  status varchar not null,
  total_amount numeric not null default 0
);
create table public.erp_purchase_receipts (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  purchase_order_id varchar not null,
  receipt_number varchar not null,
  warehouse_id varchar not null,
  product_id uuid not null,
  received_quantity numeric not null,
  unit_cost numeric not null,
  status varchar not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (business_id,receipt_number)
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
  unique (warehouse_id,product_id)
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

create function public.rc434_fail_inventory_insert() returns trigger language plpgsql as $trigger$
begin
  if new.reference_id='receipt-rollback' then raise exception 'RC434_FORCED_LEDGER_FAILURE'; end if;
  return new;
end;
$trigger$;
create trigger rc434_test_fail_inventory before insert on public.inventory_transactions
  for each row execute function public.rc434_fail_inventory_insert();
