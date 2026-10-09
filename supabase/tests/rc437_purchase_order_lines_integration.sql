-- RC437 behavioral tests; run only in a disposable PostgreSQL database.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  business uuid := '20000000-0000-4000-8000-000000000001';
  product uuid := '30000000-0000-4000-8000-000000000001';
  other_product uuid := '30000000-0000-4000-8000-000000000002';
  lines jsonb;
  result jsonb;
  n integer;
  rejected boolean;
begin
  insert into public.businesses(id,tenant_id,status) values(business,'tenant-a','ACTIVE');
  insert into public.user_memberships(user_id,tenant_id,business_id,role,status)
  values(actor,'tenant-a',business,'OWNER','ACTIVE');
  insert into public.catalog_items(id,tenant_id,business_id,status)
  values(product,'tenant-a',business,'ACTIVE'),(other_product,'tenant-a',business,'ACTIVE');
  insert into public.warehouses(id,tenant_id,business_id,branch_id,status)
  values('warehouse-a','tenant-a',business,'branch-a','ACTIVE');
  insert into public.erp_purchase_orders(id,tenant_id,business_id,status,total_amount)
  values('purchase-order-001','tenant-a',business,'DRAFT',50);

  lines:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'product_id',product,'ordered_quantity',10,'unit_cost',5,'description','Test item'
  ));
  result:=public.set_purchase_order_lines_backend('purchase-order-001','tenant-a',business,lines,actor);
  if (result->>'line_count')::integer<>1 then raise exception 'expected one purchase order line'; end if;
  update public.erp_purchase_orders set status='APPROVED' where id='purchase-order-001';

  result:=public.receive_purchase_stock_with_order_line_backend(
    'receipt-0001','tenant-a',business,'purchase-order-001','receipt-0001','warehouse-a',product,6,5,actor
  );
  if coalesce((result->>'success')::boolean,false) is not true then raise exception 'valid partial receipt failed'; end if;
  if (select received_quantity from public.erp_purchase_order_lines where purchase_order_id='purchase-order-001' and product_id=product)<>6 then
    raise exception 'received quantity not tracked';
  end if;
  if (select quantity_on_hand from public.stock_balances where warehouse_id='warehouse-a' and product_id=product)<>6 then
    raise exception 'stock balance not updated';
  end if;

  result:=public.receive_purchase_stock_with_order_line_backend(
    'receipt-0001','tenant-a',business,'purchase-order-001','receipt-0001','warehouse-a',product,6,5,actor
  );
  if (result->>'idempotent')::boolean is distinct from true then raise exception 'exact receipt replay was not idempotent'; end if;
  if (select received_quantity from public.erp_purchase_order_lines where purchase_order_id='purchase-order-001' and product_id=product)<>6 then
    raise exception 'replay incremented received quantity twice';
  end if;
  if (select quantity_on_hand from public.stock_balances where warehouse_id='warehouse-a' and product_id=product)<>6 then
    raise exception 'replay duplicated stock';
  end if;

  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend(
      'receipt-0002','tenant-a',business,'purchase-order-001','receipt-0002','warehouse-a',product,5,5,actor
    );
  exception when others then
    if sqlerrm='PURCHASE_ORDER_QUANTITY_EXCEEDED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'over-receipt was not rejected'; end if;
  if exists(select 1 from public.erp_purchase_receipts where receipt_number='receipt-0002') then raise exception 'over-receipt left a receipt'; end if;

  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend(
      'receipt-0003','tenant-a',business,'purchase-order-001','receipt-0003','warehouse-a',other_product,1,5,actor
    );
  exception when others then
    if sqlerrm='PRODUCT_NOT_IN_PURCHASE_ORDER' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'product absent from purchase order was accepted'; end if;

  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend(
      'receipt-0004','tenant-a',business,'purchase-order-001','receipt-0004','warehouse-a',product,1,4,actor
    );
  exception when others then
    if sqlerrm='PURCHASE_ORDER_UNIT_COST_MISMATCH' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'unit cost mismatch was accepted'; end if;

  rejected:=false;
  begin
    perform public.set_purchase_order_lines_backend('purchase-order-001','tenant-a',business,'null'::jsonb,actor);
  exception when others then
    if sqlerrm='PURCHASE_ORDER_LINES_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'null line payload was accepted'; end if;

  if has_function_privilege('anon','public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'anon must not execute line-aware receiving RPC';
  end if;
  if has_function_privilege('authenticated','public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'authenticated must not execute line-aware receiving RPC';
  end if;
  if not has_function_privilege('service_role','public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'service_role must execute line-aware receiving RPC';
  end if;
  if has_function_privilege('service_role','public.receive_purchase_stock_atomic_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid)','EXECUTE') then
    raise exception 'legacy receiving RPC must not be callable by service_role';
  end if;
end;
$test$;

select 'RC437 purchase order line receiving limits: PASS' as result;
