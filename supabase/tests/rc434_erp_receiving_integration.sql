-- Behavioral tests for RC434. Only run in a disposable PostgreSQL database.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  other_actor uuid := '10000000-0000-4000-8000-000000000002';
  business uuid := '20000000-0000-4000-8000-000000000001';
  product uuid := '30000000-0000-4000-8000-000000000001';
  qty numeric;
  n integer;
  result jsonb;
  rejected boolean;
begin
  insert into public.businesses(id,tenant_id,status) values(business,'tenant-a','ACTIVE');
  insert into public.user_memberships(user_id,tenant_id,business_id,role,status) values(actor,'tenant-a',business,'MANAGER','ACTIVE');
  insert into public.warehouses(id,tenant_id,business_id,branch_id,status) values('warehouse-1','tenant-a',business,'branch-1','ACTIVE');
  insert into public.catalog_items(id,tenant_id,business_id,status) values(product,'tenant-a',business,'ACTIVE');
  insert into public.erp_purchase_orders(id,tenant_id,business_id,status,total_amount) values('purchase-order-1','tenant-a',business,'APPROVED',1000);

  result := public.receive_purchase_stock_atomic_backend('receipt-0001','tenant-a',business,'purchase-order-1','GRN-1','warehouse-1',product,5,2,actor);
  if coalesce((result->>'success')::boolean,false) is not true or coalesce((result->>'idempotent')::boolean,true) is not false then
    raise exception 'first receipt did not return a fresh success: %',result;
  end if;
  select quantity_on_hand into qty from public.stock_balances where warehouse_id='warehouse-1' and product_id=product;
  if qty <> 5 then raise exception 'stock after first receipt expected 5, got %',qty; end if;
  select count(*) into n from public.erp_purchase_receipts where business_id=business and receipt_number='GRN-1';
  if n <> 1 then raise exception 'expected one receipt, got %',n; end if;
  select count(*) into n from public.inventory_transactions where reference_id='receipt-0001';
  if n <> 1 then raise exception 'expected one inventory transaction, got %',n; end if;

  result := public.receive_purchase_stock_atomic_backend('receipt-0002','tenant-a',business,'purchase-order-1','GRN-1','warehouse-1',product,5,2,actor);
  if coalesce((result->>'idempotent')::boolean,false) is not true then raise exception 'same receipt retry was not idempotent'; end if;
  select quantity_on_hand into qty from public.stock_balances where warehouse_id='warehouse-1' and product_id=product;
  if qty <> 5 then raise exception 'idempotent retry changed stock: %',qty; end if;

  rejected := false;
  begin
    perform public.receive_purchase_stock_atomic_backend('receipt-0003','tenant-a',business,'purchase-order-1','GRN-1','warehouse-1',product,6,2,actor);
  exception when others then
    if sqlerrm='RECEIPT_IDEMPOTENCY_CONFLICT' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'conflicting receipt retry was not rejected'; end if;

  rejected := false;
  begin
    perform public.receive_purchase_stock_atomic_backend('receipt-0004','tenant-a',business,'purchase-order-1','GRN-UNAUTHORIZED','warehouse-1',product,1,2,other_actor);
  exception when others then
    if sqlerrm='PURCHASE_RECEIVING_ROLE_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'actor without membership was not rejected'; end if;

  update public.erp_purchase_orders set status='DRAFT' where id='purchase-order-1';
  rejected := false;
  begin
    perform public.receive_purchase_stock_atomic_backend('receipt-0005','tenant-a',business,'purchase-order-1','GRN-DRAFT','warehouse-1',product,1,2,actor);
  exception when others then
    if sqlerrm='PURCHASE_ORDER_NOT_APPROVED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'unapproved purchase order was not rejected'; end if;
  update public.erp_purchase_orders set status='APPROVED' where id='purchase-order-1';

  rejected := false;
  begin
    perform public.receive_purchase_stock_atomic_backend('receipt-rollback','tenant-a',business,'purchase-order-1','GRN-ROLLBACK','warehouse-1',product,7,2,actor);
  exception when others then
    if sqlerrm='RC434_FORCED_LEDGER_FAILURE' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'forced ledger failure did not abort receiving transaction'; end if;
  select quantity_on_hand into qty from public.stock_balances where warehouse_id='warehouse-1' and product_id=product;
  if qty <> 5 then raise exception 'failed ledger write did not roll back stock, got %',qty; end if;
  select count(*) into n from public.erp_purchase_receipts where receipt_number='GRN-ROLLBACK';
  if n <> 0 then raise exception 'failed ledger write left a receipt row'; end if;
  select count(*) into n from public.inventory_transactions where reference_id='receipt-rollback';
  if n <> 0 then raise exception 'failed ledger write left an inventory transaction'; end if;

  if has_function_privilege('anon','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'anon must not execute RC434 receiving RPC';
  end if;
  if has_function_privilege('authenticated','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'authenticated must not execute service-role RC434 receiving RPC';
  end if;
  if not has_function_privilege('service_role','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'service_role must execute RC434 receiving RPC';
  end if;
end;
$test$;

select 'RC434 ERP purchase receiving integration: PASS' as result;
