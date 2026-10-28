create or replace function public.mnty_platform_admin_delete_business(
  p_tenant_id text, p_business_id uuid, p_actor_user_id uuid
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_business public.businesses%rowtype;
  v_branch_ids text[] := array[]::text[];
begin
  select b.* into v_business from public.businesses b
   where b.id = p_business_id and b.tenant_id = p_tenant_id for update;
  if not found then raise exception using message = 'BUSINESS_NOT_FOUND'; end if;

  select coalesce(array_agg(br.id::text), array[]::text[]) into v_branch_ids
    from public.branches br where br.tenant_id = p_tenant_id and br.business_id = p_business_id;

  if exists (select 1 from public.orders o where o.tenant_id = p_tenant_id and o.business_id = p_business_id)
     or exists (select 1 from public.restaurant_orders o where o.business_id = p_business_id)
     or exists (select 1 from public.fashion_orders o where o.business_id = p_business_id)
     or exists (select 1 from public.erp_purchase_orders o where o.tenant_id = p_tenant_id and o.business_id = p_business_id)
     or exists (select 1 from public.erp_purchase_receipts r where r.tenant_id = p_tenant_id and r.business_id = p_business_id)
     or exists (select 1 from public.erp_stock_transfers t where t.tenant_id = p_tenant_id and t.business_id = p_business_id)
     or exists (select 1 from public.refund_transactions r where r.tenant_id = p_tenant_id and r.business_id = p_business_id)
     or exists (select 1 from public.subscription_payment_intents spi where spi.business_id = p_business_id)
     or exists (select 1 from public.business_referral_events e where e.business_id = p_business_id)
     or exists (select 1 from public.agreements a where a.business_id = p_business_id)
     or exists (select 1 from public.inventory_transactions t where t.branch_id::text = any(v_branch_ids))
     or exists (select 1 from public.journal_entries j where j.branch_id::text = any(v_branch_ids))
     or exists (select 1 from public.order_status_history h where h.branch_id::text = any(v_branch_ids))
     or exists (select 1 from public.stock_balances sb where sb.branch_id::text = any(v_branch_ids)) then
    raise exception using message = 'BUSINESS_DELETE_BLOCKED_BY_HISTORY';
  end if;

  delete from public.user_memberships m where m.tenant_id = p_tenant_id and m.business_id = p_business_id;
  delete from public.departments d where d.tenant_id = p_tenant_id and d.business_id = p_business_id;
  delete from public.restaurant_inventory i where i.business_id = p_business_id;
  delete from public.restaurant_menu_items i where i.business_id = p_business_id;
  delete from public.restaurant_tables rt where rt.business_id = p_business_id;
  delete from public.fashion_products fp where fp.business_id = p_business_id;

  if cardinality(v_branch_ids) > 0 then
    delete from public.warehouses w where w.tenant_id = p_tenant_id and w.branch_id::text = any(v_branch_ids);
  end if;
  delete from public.catalog_items ci where ci.tenant_id = p_tenant_id and ci.business_id = p_business_id;
  delete from public.catalog_business_settings cbs where cbs.tenant_id = p_tenant_id and cbs.business_id = p_business_id;
  delete from public.advertisements ad where ad.tenant_id = p_tenant_id and ad.business_id = p_business_id;
  delete from public.marketing_provider_profiles mpp where mpp.business_id = p_business_id;
  delete from public.branches br where br.tenant_id = p_tenant_id and br.business_id = p_business_id;
  delete from public.businesses b where b.id = p_business_id and b.tenant_id = p_tenant_id;

  insert into public.audit_logs(tenant_id, actor_user_id, action, entity_type, entity_id, old_values, new_values, result)
  values (
    p_tenant_id, p_actor_user_id, 'BIZCATALOG_BUSINESS_DELETED', 'business', p_business_id::text,
    pg_catalog.jsonb_build_object('name', v_business.name, 'code', v_business.code),
    pg_catalog.jsonb_build_object('deleted', true), 'SUCCESS'
  );

  return pg_catalog.jsonb_build_object('success', true, 'businessId', p_business_id, 'tenantId', p_tenant_id, 'deleted', true);
end;
$function$;

revoke all on function public.mnty_platform_admin_delete_business(text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.mnty_platform_admin_delete_business(text, uuid, uuid) to service_role;