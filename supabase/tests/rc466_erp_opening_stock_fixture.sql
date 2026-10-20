create schema if not exists auth;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table public.user_memberships(user_id uuid not null,tenant_id varchar not null,business_id uuid not null,branch_id varchar,role varchar not null,status varchar not null);
create table public.warehouses(id varchar primary key,tenant_id varchar not null,business_id uuid not null,branch_id varchar,status varchar not null);
create table public.catalog_items(id uuid primary key,tenant_id varchar not null,business_id uuid not null,branch_id varchar,status varchar not null);
create or replace function public.initialize_opening_stock_backend(
 p_id varchar,p_tenant_id varchar,p_business_id uuid,p_warehouse_id varchar,p_product_id uuid,p_quantity numeric,p_unit_cost numeric,p_reference_id varchar
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 return jsonb_build_object('success',true,'actor',auth.uid(),'warehouse_id',p_warehouse_id,'product_id',p_product_id,'quantity',p_quantity,'unit_cost',p_unit_cost,'reference_id',p_reference_id);
end $$;
grant select,insert,update,delete on public.user_memberships,public.warehouses,public.catalog_items to service_role;
