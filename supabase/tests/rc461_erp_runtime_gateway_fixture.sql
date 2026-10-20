create schema if not exists auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.user_memberships(
  user_id uuid not null, tenant_id varchar not null, business_id uuid not null,
  role varchar not null, status varchar not null, branch_id varchar
);
create table public.erp_purchase_orders(
  id varchar primary key, tenant_id varchar not null, business_id uuid not null, branch_id varchar, status varchar default 'SUBMITTED'
);
create table public.erp_suppliers(
  id varchar primary key, tenant_id varchar not null, business_id uuid not null, branch_id varchar,
  supplier_code varchar, name_ar text, status varchar not null, created_by uuid
);
create table public.branches(
 id varchar primary key, tenant_id varchar not null, business_id uuid not null,
 name text not null, code varchar, status varchar not null
);
create table public.erp_stock_transfers(
  id varchar primary key, tenant_id varchar not null, business_id uuid not null,
  from_warehouse_id varchar, to_warehouse_id varchar
);
create table public.warehouses(
  id varchar primary key, tenant_id varchar not null, business_id uuid not null,
  branch_id varchar, status varchar not null
);
create table public.catalog_items(
  id uuid primary key, tenant_id varchar not null, business_id uuid not null,
  branch_id varchar, status varchar not null
);
create or replace function public.create_purchase_order_backend(
  p_id varchar,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_order_number varchar,
  p_supplier_id varchar,p_total_amount numeric,p_tax_amount numeric,p_discount_amount numeric,p_reason text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return jsonb_build_object('success',true,'actor',auth.uid(),'operation','create_purchase_order'); end $$;
create or replace function public.update_purchase_order_status_backend(p_order_id varchar,p_target_status varchar)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return jsonb_build_object('success',true,'actor',auth.uid(),'operation','update_purchase_order_status'); end $$;
create or replace function public.receive_purchase_stock_backend(
  p_id varchar,p_tenant_id varchar,p_business_id uuid,p_purchase_order_id varchar,p_receipt_number varchar,
  p_warehouse_id varchar,p_product_id uuid,p_received_quantity numeric,p_unit_cost numeric
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return jsonb_build_object('success',true,'actor',auth.uid(),'operation','receive_purchase_stock'); end $$;
create or replace function public.create_stock_transfer_backend(
  p_id varchar,p_tenant_id varchar,p_business_id uuid,p_transfer_number varchar,p_from_warehouse_id varchar,
  p_to_warehouse_id varchar,p_product_id uuid,p_quantity numeric
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return jsonb_build_object('success',true,'actor',auth.uid(),'operation','create_stock_transfer'); end $$;
create or replace function public.update_stock_transfer_status_backend(p_transfer_id varchar,p_target_status varchar)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return jsonb_build_object('success',true,'actor',auth.uid(),'operation','update_stock_transfer_status'); end $$;
create or replace function public.receive_stock_transfer_backend(p_transfer_id varchar)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin return jsonb_build_object('success',true,'actor',auth.uid(),'operation','receive_stock_transfer'); end $$;

grant select,insert,update,delete on public.user_memberships, public.erp_purchase_orders, public.erp_suppliers, public.erp_stock_transfers, public.warehouses, public.catalog_items, public.branches to service_role;
