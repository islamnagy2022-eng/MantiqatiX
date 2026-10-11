do $$
declare
  v_actor uuid := pg_catalog.gen_random_uuid();
  v_non_member uuid := pg_catalog.gen_random_uuid();
  v_business uuid := pg_catalog.gen_random_uuid();
  v_tenant varchar := 'rc461-test-tenant';
  v_branch varchar := 'rc461-test-branch';
  v_result jsonb;
  v_table_id text;
  v_inventory_id text;
  v_audit_count integer;
begin
  if has_table_privilege('anon', 'public.restaurant_tables', 'INSERT')
     or has_table_privilege('anon', 'public.restaurant_tables', 'UPDATE')
     or has_table_privilege('anon', 'public.restaurant_tables', 'DELETE')
     or has_table_privilege('anon', 'public.restaurant_inventory', 'INSERT')
     or has_table_privilege('anon', 'public.restaurant_inventory', 'UPDATE')
     or has_table_privilege('anon', 'public.restaurant_inventory', 'DELETE') then
    raise exception 'RC461_ANON_DIRECT_MUTATION_REMAINS';
  end if;
  if has_table_privilege('authenticated', 'public.restaurant_tables', 'INSERT')
     or has_table_privilege('authenticated', 'public.restaurant_tables', 'UPDATE')
     or has_table_privilege('authenticated', 'public.restaurant_tables', 'DELETE')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'INSERT')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'UPDATE')
     or has_table_privilege('authenticated', 'public.restaurant_inventory', 'DELETE') then
    raise exception 'RC461_AUTHENTICATED_DIRECT_MUTATION_REMAINS';
  end if;
  if not has_table_privilege('service_role', 'public.restaurant_tables', 'INSERT')
     or not has_table_privilege('service_role', 'public.restaurant_inventory', 'UPDATE') then
    raise exception 'RC461_BACKEND_MUTATION_GRANT_MISSING';
  end if;
  if has_function_privilege('anon','public.restaurant_workspace_mutate_backend(text,jsonb,uuid,character varying,uuid,character varying)','EXECUTE')
     or has_function_privilege('authenticated','public.restaurant_workspace_mutate_backend(text,jsonb,uuid,character varying,uuid,character varying)','EXECUTE')
     or not has_function_privilege('service_role','public.restaurant_workspace_mutate_backend(text,jsonb,uuid,character varying,uuid,character varying)','EXECUTE') then
    raise exception 'RC461_RPC_EXECUTE_BOUNDARY_INVALID';
  end if;

  insert into public.businesses(id,tenant_id,status) values(v_business,v_tenant,'ACTIVE');
  insert into public.branches(id,tenant_id,business_id,status) values(v_branch,v_tenant,v_business,'ACTIVE');
  insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status)
  values(pg_catalog.gen_random_uuid()::text,v_actor,v_tenant,v_business,v_branch,'MANAGER','ACTIVE');

  v_result := public.restaurant_workspace_mutate_backend('TABLE_SAVE',
    pg_catalog.jsonb_build_object('tableId',null,'tableNumber',12,'capacityPersons',4,'status','EMPTY','reservedCustomerName',null),
    v_actor,v_tenant,v_business,v_branch);
  if coalesce((v_result->>'ok')::boolean,false) is not true then raise exception 'RC461_TABLE_CREATE_FAILED'; end if;
  v_table_id := v_result #>> '{table,id}';
  if v_table_id is null or not exists(select 1 from public.restaurant_tables t where t.id=v_table_id and t.owner_user_id=v_actor and t.tenant_id=v_tenant and t.business_id=v_business and t.branch_id=v_branch) then
    raise exception 'RC461_TABLE_SCOPE_INVALID';
  end if;

  v_result := public.restaurant_workspace_mutate_backend('TABLE_SAVE',
    pg_catalog.jsonb_build_object('tableId',v_table_id,'tableNumber',12,'capacityPersons',4,'status','RESERVED','reservedCustomerName','Test booking'),
    v_actor,v_tenant,v_business,v_branch);
  if v_result #>> '{table,status}' <> 'RESERVED' then raise exception 'RC461_TABLE_UPDATE_FAILED'; end if;
  select count(*) into v_audit_count from public.audit_logs where entity_type='restaurant_tables' and entity_id=v_table_id and actor_user_id=v_actor;
  if v_audit_count <> 2 then raise exception 'RC461_TABLE_AUDIT_NOT_ATOMIC'; end if;
  if not exists(select 1 from public.audit_logs where entity_type='restaurant_tables' and entity_id=v_table_id and action='RESTAURANT_TABLE_UPDATED' and old_values->>'status'='EMPTY' and new_values->>'status'='RESERVED') then
    raise exception 'RC461_TABLE_AUDIT_SNAPSHOT_INVALID';
  end if;

  v_result := public.restaurant_workspace_mutate_backend('INVENTORY_SAVE',
    pg_catalog.jsonb_build_object('inventoryId',null,'name','Flour','unit','KG','currentStockQty',12.5,'minStockAlertThreshold',2,'unitCostEgp',30,'supplierName','Test vendor'),
    v_actor,v_tenant,v_business,v_branch);
  v_inventory_id := v_result #>> '{inventory,id}';
  if v_inventory_id is null or not exists(select 1 from public.restaurant_inventory i where i.id::text=v_inventory_id and i.owner_user_id=v_actor and i.tenant_id=v_tenant and i.business_id=v_business and i.branch_id=v_branch) then
    raise exception 'RC461_INVENTORY_SCOPE_INVALID';
  end if;
  v_result := public.restaurant_workspace_mutate_backend('INVENTORY_SAVE',
    pg_catalog.jsonb_build_object('inventoryId',v_inventory_id,'name','Flour','unit','KG','currentStockQty',10,'minStockAlertThreshold',2,'unitCostEgp',31,'supplierName','Test vendor'),
    v_actor,v_tenant,v_business,v_branch);
  if (v_result #>> '{inventory,current_stock_qty}')::numeric <> 10 then raise exception 'RC461_INVENTORY_UPDATE_FAILED'; end if;
  select count(*) into v_audit_count from public.audit_logs where entity_type='restaurant_inventory' and entity_id=v_inventory_id and actor_user_id=v_actor;
  if v_audit_count <> 2 then raise exception 'RC461_INVENTORY_AUDIT_NOT_ATOMIC'; end if;

  begin
    perform public.restaurant_workspace_mutate_backend('TABLE_SAVE',
      pg_catalog.jsonb_build_object('tableId',v_table_id,'tableNumber',99,'capacityPersons',4,'status','EMPTY'),
      v_non_member,v_tenant,v_business,v_branch);
    raise exception 'RC461_NON_MEMBER_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'FORBIDDEN_WORKSPACE_SCOPE' then raise; end if;
  end;

  raise notice 'RC461 restaurant workspace mutation integration: PASS';
end
$$;
