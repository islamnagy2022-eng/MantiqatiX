-- DEMO-only application boundary hardening.
-- Apply ONLY to the isolated MantiqatiX-DEMO project. Never apply to LIVE.

-- Client-side writes for core tenant/business/catalog/order state are disabled.
-- Authenticated writes must go through the verified DEMO Edge Functions/RPCs.
revoke insert, update, delete, truncate on table
  public.businesses,
  public.branches,
  public.user_memberships,
  public.marketing_provider_profiles,
  public.catalog_items,
  public.catalog_item_prices,
  public.orders,
  public.restaurant_menu_items,
  public.restaurant_orders,
  public.restaurant_tables,
  public.restaurant_inventory,
  public.medical_appointments
from anon, authenticated;

-- The DEMO UI never collects or processes payments. Keep provider, wallet,
-- settlement, accounting, subscription and SMM finance SECURITY DEFINER APIs
-- unavailable to browser roles in this isolated project. service_role retains
-- backend capability where required; no payment provider function is deployed.
do $demo$
declare
  r record;
  signature text;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and (
        p.proname ~* '(paymob|payment|wallet|settle|settlement|refund|commission|financial|journal|payout|subscription|billing|checkout|smm|erp|credit|ledger|reconcil|charge|provider_intent|trial)'
        or p.proname in ('create_order_backend','update_order_status_backend','upsert_catalog_item_backend','upsert_catalog_price_backend')
      )
  loop
    signature := format('%I.%I(%s)',r.nspname,r.proname,r.args);
    execute 'REVOKE ALL ON FUNCTION ' || signature || ' FROM PUBLIC';
    execute 'REVOKE ALL ON FUNCTION ' || signature || ' FROM anon, authenticated';
  end loop;
end;
$demo$;

-- Re-enable only the service-role execution path used by the DEMO Edge Functions
-- and the catalogue helpers already present in the bootstrap file.
grant execute on function public.create_order_backend(uuid,character varying,uuid,character varying,uuid,character varying,numeric,numeric,numeric,numeric,numeric,character varying,text,text,text,jsonb,text,jsonb) to service_role;
grant execute on function public.update_order_status_backend(uuid,character varying,uuid,character varying,text) to service_role;
grant execute on function public.demo_register_customer_atomic(uuid) to service_role;
grant execute on function public.demo_create_business_atomic(uuid,text,text,text,text,text) to service_role;
grant execute on function public.demo_upsert_catalog_item_atomic(uuid,character varying,uuid,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid) to service_role;
grant execute on function public.demo_upsert_catalog_price_atomic(uuid,character varying,uuid,character varying,uuid,numeric,character varying) to service_role;

-- Orders can only be read by the customer who owns them or staff assigned to the
-- exact business/branch. This is a restrictive guard on top of existing policies.
drop policy if exists demo_orders_read_scope on public.orders;
create policy demo_orders_read_scope on public.orders
  as restrictive for select to authenticated
  using (
    tenant_id='MNTY-PLATFORM'
    and (
      customer_id=(select auth.uid())
      or exists (
        select 1 from public.user_memberships m
        where m.user_id=(select auth.uid())
          and m.tenant_id=orders.tenant_id
          and m.business_id=orders.business_id
          and m.branch_id is not distinct from orders.branch_id
          and m.status='ACTIVE'
          and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','STAFF','EMPLOYEE')
      )
    )
  );

drop policy if exists demo_orders_update_scope on public.orders;
create policy demo_orders_update_scope on public.orders
  as restrictive for update to authenticated
  using (
    tenant_id='MNTY-PLATFORM'
    and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid())
        and m.tenant_id=orders.tenant_id
        and m.business_id=orders.business_id
        and m.branch_id is not distinct from orders.branch_id
        and m.status='ACTIVE'
        and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','STAFF','EMPLOYEE')
    )
  )
  with check (
    tenant_id='MNTY-PLATFORM'
    and exists (
      select 1 from public.user_memberships m
      where m.user_id=(select auth.uid())
        and m.tenant_id=orders.tenant_id
        and m.business_id=orders.business_id
        and m.branch_id is not distinct from orders.branch_id
        and m.status='ACTIVE'
        and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','STAFF','EMPLOYEE')
    )
  );
