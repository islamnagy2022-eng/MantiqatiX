do $$
declare
  v_actor uuid := '80000000-0000-4000-8000-000000000001';
  v_non_member uuid := '80000000-0000-4000-8000-000000000002';
  v_business uuid := pg_catalog.gen_random_uuid();
  v_other_business uuid := pg_catalog.gen_random_uuid();
  v_unassigned_business uuid := pg_catalog.gen_random_uuid();
  v_inactive_business uuid := pg_catalog.gen_random_uuid();
  v_tenant varchar := 'rc461-test-tenant';
  v_other_tenant varchar := 'rc461-other-tenant';
  v_unassigned_tenant varchar := 'rc461-unassigned-tenant';
  v_branch varchar := 'rc461-test-branch';
  v_other_branch varchar := 'rc461-other-branch';
  v_unassigned_branch varchar := 'rc461-unassigned-branch';
  v_inactive_business_branch varchar := 'rc461-inactive-business-branch';
  v_inactive_branch varchar := 'rc461-inactive-branch';
  v_result jsonb;
  v_table_id text;
  v_inventory_id text;
  v_audit_count integer;
begin
  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='restaurant_tables' and c.relrowsecurity
  ) or not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='restaurant_inventory' and c.relrowsecurity
  ) then
    raise exception 'RC461_RESTAURANT_RLS_NOT_ENABLED';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname='public' and p.tablename='restaurant_tables'
      and p.policyname='restaurant_tables_active_branch_member_select'
      and p.permissive='PERMISSIVE' and p.cmd='SELECT'
      and p.qual ilike '%user_memberships%'
  ) or not exists (
    select 1 from pg_catalog.pg_policies p
    where p.schemaname='public' and p.tablename='restaurant_inventory'
      and p.policyname='restaurant_inventory_active_branch_member_select'
      and p.permissive='PERMISSIVE' and p.cmd='SELECT'
      and p.qual ilike '%user_memberships%'
  ) then
    raise exception 'RC461_BRANCH_MEMBER_READ_POLICY_MISSING';
  end if;
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

  insert into public.businesses(id,tenant_id,status) values
    (v_business,v_tenant,'ACTIVE'),(v_other_business,v_other_tenant,'ACTIVE'),
    (v_unassigned_business,v_unassigned_tenant,'ACTIVE'),(v_inactive_business,v_tenant,'INACTIVE');
  insert into public.branches(id,tenant_id,business_id,status) values
    (v_branch,v_tenant,v_business,'ACTIVE'),(v_other_branch,v_other_tenant,v_other_business,'ACTIVE'),
    (v_unassigned_branch,v_unassigned_tenant,v_unassigned_business,'ACTIVE'),
    (v_inactive_business_branch,v_tenant,v_inactive_business,'ACTIVE'),(v_inactive_branch,v_tenant,v_business,'INACTIVE');
  insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status)
  values(pg_catalog.gen_random_uuid()::text,v_actor,v_tenant,v_business,v_branch,'MANAGER','ACTIVE'),
        (pg_catalog.gen_random_uuid()::text,v_actor,v_other_tenant,v_other_business,v_other_branch,'MANAGER','ACTIVE'),
        (pg_catalog.gen_random_uuid()::text,v_actor,v_tenant,v_inactive_business,v_inactive_business_branch,'MANAGER','ACTIVE'),
        (pg_catalog.gen_random_uuid()::text,v_actor,v_tenant,v_business,v_inactive_branch,'MANAGER','ACTIVE');

  -- Seed records in a branch for which the authenticated actor has no membership.
  insert into public.restaurant_tables(id,tenant_id,business_id,branch_id,owner_user_id,table_number,capacity_persons,status)
  values('rc461-unassigned-table',v_unassigned_tenant,v_unassigned_business,v_unassigned_branch,v_non_member,99,2,'EMPTY');
  insert into public.restaurant_inventory(id,tenant_id,business_id,branch_id,owner_user_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name)
  values('rc461-unassigned-inventory',v_unassigned_tenant,v_unassigned_business,v_unassigned_branch,v_non_member,'Private item','KG',1,0,1,'');

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

  begin
    perform public.restaurant_workspace_mutate_backend('TABLE_SAVE',
      pg_catalog.jsonb_build_object('tableId',v_table_id,'tableNumber',99,'capacityPersons',4,'status','EMPTY'),
      v_actor,v_other_tenant,v_other_business,v_other_branch);
    raise exception 'RC461_CROSS_SCOPE_TABLE_UPDATE_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'TABLE_NOT_FOUND_IN_SCOPE' then raise; end if;
  end;

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
    perform public.restaurant_workspace_mutate_backend('INVENTORY_SAVE',
      pg_catalog.jsonb_build_object('inventoryId',v_inventory_id,'name','Flour','unit','KG','currentStockQty',99,'minStockAlertThreshold',2,'unitCostEgp',31,'supplierName','Test vendor'),
      v_actor,v_other_tenant,v_other_business,v_other_branch);
    raise exception 'RC461_CROSS_SCOPE_INVENTORY_UPDATE_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'INVENTORY_NOT_FOUND_IN_SCOPE' then raise; end if;
  end;

  begin
    perform public.restaurant_workspace_mutate_backend('TABLE_SAVE',
      pg_catalog.jsonb_build_object('tableId',v_table_id,'tableNumber',99,'capacityPersons',4,'status','EMPTY'),
      v_non_member,v_tenant,v_business,v_branch);
    raise exception 'RC461_NON_MEMBER_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'FORBIDDEN_WORKSPACE_SCOPE' then raise; end if;
  end;

  -- A valid membership must not override an inactive business or inactive branch.
  begin
    perform public.restaurant_workspace_mutate_backend('TABLE_SAVE',
      pg_catalog.jsonb_build_object('tableId',null,'tableNumber',21,'capacityPersons',2,'status','EMPTY'),
      v_actor,v_tenant,v_inactive_business,v_inactive_business_branch);
    raise exception 'RC461_INACTIVE_BUSINESS_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'BUSINESS_NOT_AVAILABLE' then raise; end if;
  end;

  begin
    perform public.restaurant_workspace_mutate_backend('TABLE_SAVE',
      pg_catalog.jsonb_build_object('tableId',null,'tableNumber',22,'capacityPersons',2,'status','EMPTY'),
      v_actor,v_tenant,v_business,v_inactive_branch);
    raise exception 'RC461_INACTIVE_BRANCH_WAS_ALLOWED';
  exception when others then
    if sqlerrm <> 'BRANCH_NOT_AVAILABLE' then raise; end if;
  end;

  raise notice 'RC461 restaurant workspace mutation integration: PASS';
end
$$;

-- Exercise the real RLS SELECT policies as the authenticated role, not as the table owner.
begin;
select pg_catalog.set_config('request.jwt.claim.sub','80000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare
  v_visible_tables integer;
  v_visible_inventory integer;
begin
  select count(*) into v_visible_tables from public.restaurant_tables
    where tenant_id='rc461-test-tenant' and branch_id='rc461-test-branch';
  select count(*) into v_visible_inventory from public.restaurant_inventory
    where tenant_id='rc461-test-tenant' and branch_id='rc461-test-branch';
  if v_visible_tables < 1 or v_visible_inventory < 1 then
    raise exception 'RC461_ACTIVE_BRANCH_MEMBER_CANNOT_READ_WORKSPACE';
  end if;
  if exists(select 1 from public.restaurant_tables where id='rc461-unassigned-table')
     or exists(select 1 from public.restaurant_inventory where id='rc461-unassigned-inventory') then
    raise exception 'RC461_UNASSIGNED_BRANCH_DATA_LEAKED';
  end if;
end
$$;
rollback;
