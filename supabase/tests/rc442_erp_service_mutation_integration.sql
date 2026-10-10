-- RC442 behavior + grants integration test on disposable PostgreSQL only.
do $test$
declare
  manager_id uuid := '10000000-0000-4000-8000-000000004420';
  owner_id uuid := '10000000-0000-4000-8000-000000004421';
  other_tenant_id uuid := '10000000-0000-4000-8000-000000004422';
  customer_id uuid := '10000000-0000-4000-8000-000000004423';
  business uuid := '20000000-0000-4000-8000-000000004420';
  product uuid := '30000000-0000-4000-8000-000000004420';
  result jsonb;
  rejected boolean;
  source_qty numeric;
  destination_qty numeric;
  txn_count integer;
begin
  if has_function_privilege('anon','public.update_purchase_order_status_service_backend(character varying,character varying,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.update_purchase_order_status_service_backend(character varying,character varying,uuid)','EXECUTE') then
    raise exception 'client roles must not execute purchase-order status service RPC';
  end if;
  if has_function_privilege('anon','public.create_stock_transfer_service_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.create_stock_transfer_service_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,uuid)','EXECUTE') then
    raise exception 'client roles must not execute stock-transfer create service RPC';
  end if;
  if has_function_privilege('anon','public.update_stock_transfer_status_service_backend(character varying,character varying,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.update_stock_transfer_status_service_backend(character varying,character varying,uuid)','EXECUTE') then
    raise exception 'client roles must not execute stock-transfer status service RPC';
  end if;
  if has_function_privilege('anon','public.receive_stock_transfer_service_backend(character varying,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.receive_stock_transfer_service_backend(character varying,uuid)','EXECUTE') then
    raise exception 'client roles must not execute stock-transfer receive service RPC';
  end if;
  if not has_function_privilege('service_role','public.update_purchase_order_status_service_backend(character varying,character varying,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.create_stock_transfer_service_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.update_stock_transfer_status_service_backend(character varying,character varying,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.receive_stock_transfer_service_backend(character varying,uuid)','EXECUTE') then
    raise exception 'service_role must execute each service RPC';
  end if;

  insert into public.user_memberships(id,user_id,tenant_id,business_id,role,status) values
    ('mem-manager',manager_id,'tenant-a',business,'MANAGER','ACTIVE'),
    ('mem-owner',owner_id,'tenant-a',business,'OWNER','ACTIVE'),
    ('mem-other',other_tenant_id,'tenant-b','20000000-0000-4000-8000-000000004429','MANAGER','ACTIVE'),
    ('mem-customer',customer_id,'tenant-a',business,'CUSTOMER','ACTIVE');
  insert into public.erp_purchase_orders(id,tenant_id,business_id,order_number,supplier_id,total_amount,status,created_by)
  values ('po-low-rc442','tenant-a',business,'PO-RC442-LOW','supplier-a',100,'DRAFT',manager_id),
         ('po-high-rc442','tenant-a',business,'PO-RC442-HIGH','supplier-a',6000,'DRAFT',manager_id),
         ('po-customer-rc442','tenant-a',business,'PO-RC442-CUSTOMER','supplier-a',100,'DRAFT',customer_id);
  insert into public.warehouses(id,tenant_id,business_id,name,code,status) values
    ('wh-source','tenant-a',business,'Source','SRC','ACTIVE'),
    ('wh-dest','tenant-a',business,'Destination','DST','ACTIVE'),
    ('wh-inactive','tenant-a',business,'Inactive','INA','INACTIVE');
  insert into public.catalog_items(id,tenant_id,business_id,name_ar,status)
  values (product,'tenant-a',business,'RC442 product','ACTIVE');
  insert into public.stock_balances(id,tenant_id,business_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
  values ('sb-source','tenant-a',business,'wh-source',product,25,5),
         ('sb-dest','tenant-a',business,'wh-dest',product,2,0);

  result:=public.update_purchase_order_status_service_backend('po-low-rc442','SUBMITTED',manager_id);
  if result->'order'->>'status'<>'SUBMITTED' then raise exception 'small order was not submitted'; end if;
  result:=public.update_purchase_order_status_service_backend('po-high-rc442','SUBMITTED',manager_id);
  if result->'order'->>'status'<>'PENDING_APPROVAL' then raise exception 'large order did not require approval'; end if;

  rejected:=false;
  begin
    perform public.update_purchase_order_status_service_backend('po-customer-rc442','SUBMITTED',customer_id);
    raise exception 'TEST_FAILED: customer unexpectedly submitted a purchase order';
  exception when others then
    if sqlerrm<>'PURCHASE_ORDER_ROLE_REQUIRED' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'customer purchase-order submission was not rejected'; end if;

  rejected:=false;
  begin
    perform public.update_purchase_order_status_service_backend('po-high-rc442','APPROVED',manager_id);
    raise exception 'TEST_FAILED: manager unexpectedly approved a high-value order';
  exception when others then
    if sqlerrm<>'INVALID_STATUS_TRANSITION' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'manager approval was not rejected'; end if;
  result:=public.update_purchase_order_status_service_backend('po-high-rc442','APPROVED',owner_id);
  if result->'order'->>'status'<>'APPROVED' then raise exception 'owner could not approve high-value order'; end if;

  rejected:=false;
  begin
    perform public.create_stock_transfer_service_backend('tr-denied-rc442','tenant-a',business,'TR-DENIED','wh-source','wh-dest',product,1,other_tenant_id);
    raise exception 'TEST_FAILED: cross-tenant transfer creation unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'ERP_INVENTORY_ROLE_REQUIRED' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'cross-tenant transfer creation was not rejected'; end if;

  result:=public.create_stock_transfer_service_backend('tr-rc442-0001','tenant-a',business,'TR-RC442-001','wh-source','wh-dest',product,10,manager_id);
  if result->>'success'<>'true' or result->'transfer'->>'status'<>'REQUESTED' then raise exception 'transfer creation failed'; end if;
  result:=public.create_stock_transfer_service_backend('tr-rc442-0001','tenant-a',business,'TR-RC442-001','wh-source','wh-dest',product,10,manager_id);
  if result->>'idempotent'<>'true' then raise exception 'exact transfer replay was not idempotent'; end if;

  -- Idempotency must not bypass current active-membership checks.
  update public.user_memberships set status='SUSPENDED' where user_id=manager_id and tenant_id='tenant-a' and business_id=business;
  rejected:=false;
  begin
    perform public.create_stock_transfer_service_backend('tr-rc442-0001','tenant-a',business,'TR-RC442-001','wh-source','wh-dest',product,10,manager_id);
    raise exception 'TEST_FAILED: suspended member replay unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'ERP_INVENTORY_ROLE_REQUIRED' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'suspended member replay was not rejected'; end if;
  update public.user_memberships set status='ACTIVE' where user_id=manager_id and tenant_id='tenant-a' and business_id=business;
  rejected:=false;
  begin
    perform public.create_stock_transfer_service_backend('tr-rc442-0001','tenant-a',business,'TR-RC442-001','wh-source','wh-dest',product,11,manager_id);
    raise exception 'TEST_FAILED: conflicting transfer replay unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'TRANSFER_IDEMPOTENCY_CONFLICT' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'conflicting transfer replay was not rejected'; end if;

  result:=public.update_stock_transfer_status_service_backend('tr-rc442-0001','APPROVED',manager_id);
  if result->'transfer'->>'status'<>'APPROVED' then raise exception 'transfer approval failed'; end if;
  result:=public.update_stock_transfer_status_service_backend('tr-rc442-0001','IN_TRANSIT',manager_id);
  if result->'transfer'->>'status'<>'IN_TRANSIT' then raise exception 'transfer dispatch failed'; end if;

  update public.warehouses set status='INACTIVE' where id='wh-dest';
  rejected:=false;
  begin
    perform public.receive_stock_transfer_service_backend('tr-rc442-0001',manager_id);
    raise exception 'TEST_FAILED: receiving into an inactive warehouse unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'TARGET_WAREHOUSE_INVALID' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'inactive target warehouse was not rejected'; end if;
  update public.warehouses set status='ACTIVE' where id='wh-dest';

  result:=public.receive_stock_transfer_service_backend('tr-rc442-0001',manager_id);
  if result->'transfer'->>'status'<>'COMPLETED' or result->>'idempotent'<>'false' then raise exception 'transfer receive failed'; end if;
  select quantity_on_hand into source_qty from public.stock_balances where id='sb-source';
  select quantity_on_hand into destination_qty from public.stock_balances where id='sb-dest';
  select count(*) into txn_count from public.inventory_transactions where reference_id='tr-rc442-0001';
  if source_qty<>15 or destination_qty<>12 or txn_count<>2 then
    raise exception 'stock/ledger mismatch: source %, destination %, txns %',source_qty,destination_qty,txn_count;
  end if;
  result:=public.receive_stock_transfer_service_backend('tr-rc442-0001',manager_id);
  if result->>'idempotent'<>'true' then raise exception 'completed transfer replay was not idempotent'; end if;
  select quantity_on_hand into source_qty from public.stock_balances where id='sb-source';
  select quantity_on_hand into destination_qty from public.stock_balances where id='sb-dest';
  select count(*) into txn_count from public.inventory_transactions where reference_id='tr-rc442-0001';
  if source_qty<>15 or destination_qty<>12 or txn_count<>2 then raise exception 'transfer replay duplicated stock or ledger mutations'; end if;

  rejected:=false;
  begin
    perform public.create_stock_transfer_service_backend('tr-inactive-rc442','tenant-a',business,'TR-INACTIVE','wh-source','wh-inactive',product,1,manager_id);
    raise exception 'TEST_FAILED: inactive destination warehouse unexpectedly succeeded';
  exception when others then
    if sqlerrm<>'TARGET_WAREHOUSE_INVALID' then raise; end if;
    rejected:=true;
  end;
  if not rejected then raise exception 'inactive destination warehouse was not rejected'; end if;
end
$test$;

select 'RC442 ERP service mutation integration: PASS' as result;
