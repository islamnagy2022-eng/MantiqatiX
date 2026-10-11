do $test$
declare
  v_result jsonb;
  v_catalog_id uuid;
  v_item_id text := '30000000-0000-4000-8000-000000000001';
  v_actor uuid := '20000000-0000-4000-8000-000000000001';
  v_tenant_b uuid := '20000000-0000-4000-8000-000000000002';
  v_payload jsonb := jsonb_build_object(
    'id','30000000-0000-4000-8000-000000000001',
    'tenant_id','TENANT-A',
    'business_id','10000000-0000-4000-8000-000000000001',
    'branch_id','BRANCH-A',
    'name_ar','وجبة اختبار',
    'description_ar','وصف اختبار',
    'category','وجبات',
    'base_price_egp',100,
    'is_available',true,
    'is_popular',false
  );
begin
  if has_function_privilege('anon','public.restaurant_menu_catalog_mutate_backend(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.restaurant_menu_catalog_mutate_backend(uuid,text,jsonb)','EXECUTE') then
    raise exception 'menu catalog RPC must not be executable by anon/authenticated';
  end if;
  if not has_function_privilege('service_role','public.restaurant_menu_catalog_mutate_backend(uuid,text,jsonb)','EXECUTE') then
    raise exception 'service_role must be able to invoke the protected menu catalog RPC';
  end if;

  execute 'set role service_role';
  v_result := public.restaurant_menu_catalog_mutate_backend(v_actor,'CREATE',v_payload);
  execute 'reset role';
  if coalesce((v_result->>'ok')::boolean,false) is not true or coalesce((v_result->>'changed')::boolean,false) is not true then
    raise exception 'first create must report a changed successful result: %',v_result;
  end if;
  if (select count(*) from public.restaurant_menu_items where id=v_item_id)<>1 then raise exception 'local menu item was not created'; end if;
  select id into v_catalog_id from public.catalog_items where business_id='10000000-0000-4000-8000-000000000001' and legacy_ref='RESTAURANT_MENU:'||v_item_id;
  if v_catalog_id is null then raise exception 'canonical catalog item was not created'; end if;
  if not exists(select 1 from public.catalog_items where id=v_catalog_id and item_type='PRODUCT' and status='ACTIVE' and name_ar='وجبة اختبار') then
    raise exception 'canonical catalog projection is incorrect';
  end if;
  if not exists(select 1 from public.catalog_item_prices where catalog_item_id=v_catalog_id and branch_id='BRANCH-A' and unit_price=100 and version=1 and status='ACTIVE') then
    raise exception 'initial active branch price was not created';
  end if;
  if (select count(*) from public.audit_logs where entity_id=v_item_id)<>1 then raise exception 'create must write exactly one audit record'; end if;

  execute 'set role service_role';
  v_result := public.restaurant_menu_catalog_mutate_backend(v_actor,'CREATE',v_payload);
  execute 'reset role';
  if coalesce((v_result->>'changed')::boolean,true) is not false then raise exception 'replayed identical create should be a no-op'; end if;
  if (select count(*) from public.catalog_items where business_id='10000000-0000-4000-8000-000000000001' and legacy_ref='RESTAURANT_MENU:'||v_item_id)<>1 then raise exception 'replayed create duplicated catalog item'; end if;
  if (select count(*) from public.catalog_item_prices where catalog_item_id=v_catalog_id)<>1 then raise exception 'replayed create duplicated price history'; end if;
  if (select count(*) from public.audit_logs where entity_id=v_item_id)<>1 then raise exception 'no-op replay duplicated audit'; end if;

  v_payload := v_payload || jsonb_build_object('name_ar','وجبة اختبار معدلة','base_price_egp',125);
  execute 'set role service_role';
  v_result := public.restaurant_menu_catalog_mutate_backend(v_actor,'UPDATE',v_payload);
  execute 'reset role';
  if coalesce((v_result->>'changed')::boolean,false) is not true then raise exception 'price/name update should report change'; end if;
  if not exists(select 1 from public.restaurant_menu_items where id=v_item_id and name_ar='وجبة اختبار معدلة' and base_price_egp=125) then raise exception 'local menu update missing'; end if;
  if not exists(select 1 from public.catalog_items where id=v_catalog_id and name_ar='وجبة اختبار معدلة') then raise exception 'canonical catalog update missing'; end if;
  if (select count(*) from public.catalog_item_prices where catalog_item_id=v_catalog_id)<>2 then raise exception 'price change must preserve the previous version'; end if;
  if (select count(*) from public.catalog_item_prices where catalog_item_id=v_catalog_id and status='ACTIVE' and unit_price=125 and version=2)<>1 then raise exception 'new price version is not active'; end if;
  if (select count(*) from public.catalog_item_prices where catalog_item_id=v_catalog_id and status='INACTIVE' and unit_price=100 and effective_to is not null)<>1 then raise exception 'old price was not closed'; end if;

  v_payload := v_payload || jsonb_build_object('is_available',false);
  execute 'set role service_role';
  v_result := public.restaurant_menu_catalog_mutate_backend(v_actor,'UPDATE',v_payload);
  execute 'reset role';
  if not exists(select 1 from public.catalog_items where id=v_catalog_id and status='INACTIVE') then raise exception 'unavailable menu item must be removed from the order catalog'; end if;

  v_payload := v_payload || jsonb_build_object('id','30000000-0000-4000-8000-000000000009','tenant_id','TENANT-B','business_id','10000000-0000-4000-8000-000000000002','branch_id','BRANCH-B');
  begin
    execute 'set role service_role';
    perform public.restaurant_menu_catalog_mutate_backend(v_actor,'CREATE',v_payload);
    execute 'reset role';
    raise exception 'cross-tenant menu write was accepted';
  exception when others then
    execute 'reset role';
    if sqlerrm='cross-tenant menu write was accepted' then raise; end if;
    if sqlerrm not like 'RESTAURANT_MENU_FORBIDDEN%' then raise; end if;
  end;

  if (select count(*) from public.audit_logs where entity_id=v_item_id)<>3 then raise exception 'create, price update, and availability update must each be audited'; end if;

  -- A second active manager in the same business/branch can edit the shared menu.
  v_actor := '20000000-0000-4000-8000-000000000003';
  v_payload := jsonb_build_object(
    'id',v_item_id,'tenant_id','TENANT-A',
    'business_id','10000000-0000-4000-8000-000000000001','branch_id','BRANCH-A',
    'name_ar','وجبة اختبار معدلة','description_ar','وصف اختبار','category','وجبات',
    'base_price_egp',125,'is_available',false,'is_popular',true
  );
  execute 'set role service_role';
  v_result := public.restaurant_menu_catalog_mutate_backend(v_actor,'UPDATE',v_payload);
  execute 'reset role';
  if coalesce((v_result->>'changed')::boolean,false) is not true then
    raise exception 'same-scope manager could not update a shared menu item';
  end if;
  if not exists(select 1 from public.restaurant_menu_items where id=v_item_id and is_popular=true) then
    raise exception 'same-scope manager menu update was not persisted';
  end if;
  if (select count(*) from public.audit_logs where entity_id=v_item_id)<>4 then
    raise exception 'same-scope manager update must be audited';
  end if;
end;
$test$;
select 'RC459 restaurant menu/catalog atomic integration: PASS' as result;
