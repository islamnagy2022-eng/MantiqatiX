-- RC461: enforce server-authoritative restaurant table and inventory writes.
-- Reads remain available under existing RLS policies. Mutations now pass through
-- restaurant-workspace-mutate, which verifies the actor's active tenant/business/branch membership.
revoke insert, update, delete on table public.restaurant_tables, public.restaurant_inventory
  from PUBLIC, anon, authenticated;

-- The Edge Function uses the service role only after validating the actor and exact workspace scope.
grant select, insert, update, delete on table public.restaurant_tables, public.restaurant_inventory to service_role;

do $$
begin
  if has_table_privilege('authenticated', 'public.restaurant_tables', 'INSERT')
     or has_table_privilege('authenticated', 'public.restaurant_tables', 'UPDATE')
     or has_table_privilege('authenticated', 'public.restaurant_tables', 'DELETE')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'INSERT')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'UPDATE')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'DELETE') then
    raise exception 'RC461_DIRECT_RESTAURANT_MUTATION_PRIVILEGE_REMAINS';
  end if;
end
$$;

create or replace function public.restaurant_workspace_mutate_backend(
  p_action text,
  p_payload jsonb,
  p_actor_user_id uuid,
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_id text;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb;
  v_table_number integer;
  v_capacity integer;
  v_status text;
  v_reserved text;
  v_name text;
  v_unit text;
  v_stock numeric;
  v_minimum numeric;
  v_cost numeric;
  v_supplier text;
begin
  if p_actor_user_id is null or p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_tenant_id is null or p_tenant_id = '' or p_business_id is null or p_branch_id is null or p_branch_id = '' then
    raise exception 'INVALID_WORKSPACE_MUTATION';
  end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id = p_actor_user_id
    and m.tenant_id = p_tenant_id
    and m.business_id = p_business_id
    and m.branch_id = p_branch_id
    and m.status = 'ACTIVE'
    and upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SERVICE_PROVIDER','STAFF')
  limit 1;
  if v_role is null then raise exception 'FORBIDDEN_WORKSPACE_SCOPE'; end if;

  if p_action = 'TABLE_SAVE' then
    v_table_number := (p_payload->>'tableNumber')::integer;
    v_capacity := (p_payload->>'capacityPersons')::integer;
    v_status := upper(p_payload->>'status');
    v_reserved := nullif(pg_catalog.btrim(p_payload->>'reservedCustomerName'), '');
    if v_table_number is null or v_table_number < 1 or v_table_number > 100000
       or v_capacity is null or v_capacity < 1 or v_capacity > 1000
       or v_status is null or v_status not in ('EMPTY','OCCUPIED','RESERVED','CLEANING','OUT_OF_SERVICE')
       or pg_catalog.length(coalesce(v_reserved,'')) > 200 then
      raise exception 'INVALID_TABLE_DATA';
    end if;

    v_id := nullif(p_payload->>'tableId','');
    if v_id is not null then
      select pg_catalog.to_jsonb(t) into v_old
      from public.restaurant_tables t
      where t.id = v_id and t.tenant_id = p_tenant_id and t.business_id = p_business_id and t.branch_id = p_branch_id
      for update;
      if not found then raise exception 'TABLE_NOT_FOUND_IN_SCOPE'; end if;
      update public.restaurant_tables t
      set table_number=v_table_number, capacity_persons=v_capacity, status=v_status, reserved_customer_name=v_reserved
      where t.id=v_id and t.tenant_id=p_tenant_id and t.business_id=p_business_id and t.branch_id=p_branch_id
      returning pg_catalog.to_jsonb(t) into v_new;
    else
      v_id := pg_catalog.gen_random_uuid()::text;
      insert into public.restaurant_tables as t(id,tenant_id,business_id,branch_id,owner_user_id,table_number,capacity_persons,status,reserved_customer_name,current_active_order_id,current_bill_egp)
      values(v_id,p_tenant_id,p_business_id,p_branch_id,p_actor_user_id,v_table_number,v_capacity,v_status,v_reserved,null,0)
      returning pg_catalog.to_jsonb(t) into v_new;
    end if;
    insert into public.audit_logs(id,tenant_id,business_id,branch_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
    values(pg_catalog.gen_random_uuid()::text,p_tenant_id,p_business_id,p_branch_id,p_actor_user_id,
      case when v_old = '{}'::jsonb then 'RESTAURANT_TABLE_CREATED' else 'RESTAURANT_TABLE_UPDATED' end,
      'restaurant_tables',v_id,v_old,v_new);
    return pg_catalog.jsonb_build_object('ok',true,'table',v_new);

  elsif p_action = 'INVENTORY_SAVE' then
    v_name := pg_catalog.btrim(coalesce(p_payload->>'name',''));
    v_unit := pg_catalog.btrim(coalesce(p_payload->>'unit',''));
    v_stock := (p_payload->>'currentStockQty')::numeric;
    v_minimum := (p_payload->>'minStockAlertThreshold')::numeric;
    v_cost := (p_payload->>'unitCostEgp')::numeric;
    v_supplier := nullif(pg_catalog.btrim(p_payload->>'supplierName'),'');
    if v_name = '' or pg_catalog.length(v_name)>200 or v_unit = '' or pg_catalog.length(v_unit)>32
       or v_stock is null or v_stock < 0 or v_stock > 1000000000
       or v_minimum is null or v_minimum < 0 or v_minimum > 1000000000
       or v_cost is null or v_cost < 0 or v_cost > 1000000000
       or pg_catalog.length(coalesce(v_supplier,''))>200 then
      raise exception 'INVALID_INVENTORY_DATA';
    end if;

    v_id := nullif(p_payload->>'inventoryId','');
    if v_id is not null then
      select pg_catalog.to_jsonb(i) into v_old
      from public.restaurant_inventory i
      where i.id = v_id and i.tenant_id = p_tenant_id and i.business_id = p_business_id and i.branch_id = p_branch_id
      for update;
      if not found then raise exception 'INVENTORY_NOT_FOUND_IN_SCOPE'; end if;
      update public.restaurant_inventory i
      set name_ar=v_name, unit=v_unit, current_stock_qty=v_stock, min_stock_alert_threshold=v_minimum,
          unit_cost_egp=v_cost, supplier_name=coalesce(v_supplier,''), updated_at=pg_catalog.now()
      where i.id=v_id and i.tenant_id=p_tenant_id and i.business_id=p_business_id and i.branch_id=p_branch_id
      returning pg_catalog.to_jsonb(i) into v_new;
    else
      v_id := pg_catalog.gen_random_uuid()::text;
      insert into public.restaurant_inventory as i(id,tenant_id,business_id,branch_id,owner_user_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name,updated_at)
      values(v_id,p_tenant_id,p_business_id,p_branch_id,p_actor_user_id,v_name,v_unit,v_stock,v_minimum,v_cost,coalesce(v_supplier,''),pg_catalog.now())
      returning pg_catalog.to_jsonb(i) into v_new;
    end if;
    insert into public.audit_logs(id,tenant_id,business_id,branch_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
    values(pg_catalog.gen_random_uuid()::text,p_tenant_id,p_business_id,p_branch_id,p_actor_user_id,
      case when v_old = '{}'::jsonb then 'RESTAURANT_INVENTORY_CREATED' else 'RESTAURANT_INVENTORY_UPDATED' end,
      'restaurant_inventory',v_id,v_old,v_new);
    return pg_catalog.jsonb_build_object('ok',true,'inventory',v_new);
  end if;

  raise exception 'INVALID_WORKSPACE_MUTATION_ACTION';
end
$function$;

revoke all on function public.restaurant_workspace_mutate_backend(text,jsonb,uuid,character varying,uuid,character varying) from PUBLIC, anon, authenticated;
grant execute on function public.restaurant_workspace_mutate_backend(text,jsonb,uuid,character varying,uuid,character varying) to service_role;
