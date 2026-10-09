-- Behavioral tests for RC437/RC438. Run only in disposable PostgreSQL.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  other_actor uuid := '10000000-0000-4000-8000-000000000002';
  business uuid := '20000000-0000-4000-8000-000000000001';
  product uuid := '30000000-0000-4000-8000-000000000001';
  other_product uuid := '30000000-0000-4000-8000-000000000002';
  order_id varchar := 'po-rc437-order-001';
  lines jsonb;
  result jsonb;
  rejected boolean;
  v public.erp_purchase_orders%rowtype;
  n numeric;
begin
  insert into public.businesses values(business,'tenant-a','ACTIVE');
  insert into public.user_memberships(user_id,tenant_id,business_id,role,status)
    values(actor,'tenant-a',business,'OWNER','ACTIVE'),(other_actor,'tenant-b',business,'OWNER','ACTIVE');
  insert into public.catalog_items values(product,'tenant-a',business,'ACTIVE'),(other_product,'tenant-a',business,'ACTIVE');
  insert into public.warehouses values('warehouse-a','tenant-a',business,'branch-a','ACTIVE');
  insert into public.branches values('branch-a',business);
  lines:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('product_id',product,'quantity',10,'unit_cost',600));

  perform set_config('request.jwt.claim.sub',actor::text,true);
  result:=public.create_purchase_order_with_lines_backend(order_id,'tenant-a',business,'branch-a','PO-437-001','supplier-a',0,0,'test purchase',lines);
  if result->>'success'<>'true' or result->>'idempotent'<>'false' then raise exception 'purchase order should be created with line items'; end if;
  if (result->'order'->>'total_amount')::numeric<>6000 then raise exception 'server must calculate order total from lines'; end if;
  if (select count(*) from public.erp_purchase_order_lines where purchase_order_id=order_id)<>1 then raise exception 'order line was not persisted'; end if;
  result:=public.create_purchase_order_with_lines_backend(order_id,'tenant-a',business,'branch-a','PO-437-001','supplier-a',0,0,'test purchase',lines);
  if result->>'idempotent'<>'true' then raise exception 'identical create retry must be idempotent'; end if;
  rejected:=false;
  begin
    perform public.create_purchase_order_with_lines_backend(order_id,'tenant-a',business,'branch-a','PO-437-001','supplier-a',0,0,'test purchase',
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('product_id',product,'quantity',9,'unit_cost',600)));
  exception when others then if sqlerrm='PURCHASE_ORDER_IDEMPOTENCY_CONFLICT' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'changed lines on retry must be rejected'; end if;
  rejected:=false;
  begin
    perform public.create_purchase_order_with_lines_backend('po-rc437-no-lines','tenant-a',business,'branch-a','PO-EMPTY','supplier-a',0,0,null,'[]'::jsonb);
  exception when others then if sqlerrm='PURCHASE_ORDER_LINES_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'empty purchase order lines must be rejected'; end if;

  perform public.update_purchase_order_status_backend(order_id,'SUBMITTED');
  select * into v from public.erp_purchase_orders where id=order_id;
  if v.status<>'PENDING_APPROVAL' then raise exception 'high-value order must require approval'; end if;
  perform public.update_purchase_order_status_backend(order_id,'APPROVED');
  select * into v from public.erp_purchase_orders where id=order_id;
  if v.status<>'APPROVED' then raise exception 'owner approval failed'; end if;

  result:=public.receive_purchase_stock_with_order_line_backend('receipt-001','tenant-a',business,order_id,'RC-001','warehouse-a',product,6,600,actor);
  if result->>'success'<>'true' or result->>'idempotent'<>'false' then raise exception 'first partial receipt failed'; end if;
  result:=public.receive_purchase_stock_with_order_line_backend('receipt-001','tenant-a',business,order_id,'RC-001','warehouse-a',product,6,600,actor);
  if result->>'idempotent'<>'true' then raise exception 'duplicate receipt must be idempotent'; end if;
  result:=public.receive_purchase_stock_with_order_line_backend('receipt-002','tenant-a',business,order_id,'RC-002','warehouse-a',product,4,600,actor);
  if result->>'success'<>'true' then raise exception 'remaining ordered quantity should be receivable'; end if;
  select received_quantity into n from public.erp_purchase_order_lines where purchase_order_id=order_id and product_id=product;
  if n<>10 then raise exception 'received quantity should equal ordered quantity'; end if;
  select quantity_on_hand into n from public.stock_balances where warehouse_id='warehouse-a' and product_id=product;
  if n<>10 then raise exception 'stock should equal actual receipts'; end if;

  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend('receipt-003','tenant-a',business,order_id,'RC-003','warehouse-a',product,1,600,actor);
  exception when others then if sqlerrm='PURCHASE_ORDER_QUANTITY_EXCEEDED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'receiving over ordered quantity must be rejected'; end if;
  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend('receipt-004','tenant-a',business,order_id,'RC-004','warehouse-a',other_product,1,600,actor);
  exception when others then if sqlerrm='PRODUCT_NOT_IN_PURCHASE_ORDER' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'product absent from purchase order must be rejected'; end if;
  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend('receipt-005','tenant-a',business,order_id,'RC-005','warehouse-a',product,1,500,actor);
  exception when others then if sqlerrm='PURCHASE_ORDER_QUANTITY_EXCEEDED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'over-receipt should be rejected before cost comparison'; end if;

  -- Low-value order must auto-approve so the receipt flow cannot strand it in SUBMITTED.
  result:=public.create_purchase_order_with_lines_backend('po-rc437-rollback','tenant-a',business,'branch-a','PO-ROLLBACK','supplier-a',0,0,null,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('product_id',other_product,'quantity',1,'unit_cost',10)));
  perform public.update_purchase_order_status_backend('po-rc437-rollback','SUBMITTED');
  select * into v from public.erp_purchase_orders where id='po-rc437-rollback';
  if v.status<>'APPROVED' then raise exception 'low-value order must auto-approve'; end if;
  rejected:=false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend('receipt-rollback','tenant-a',business,'po-rc437-rollback','RC-ROLLBACK','warehouse-a',other_product,1,10,actor);
  exception when others then if sqlerrm='RC437_FORCED_LEDGER_FAILURE' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'forced ledger failure did not abort receipt'; end if;
  select received_quantity into n from public.erp_purchase_order_lines where purchase_order_id='po-rc437-rollback' and product_id=other_product;
  if n<>0 then raise exception 'failed receipt must not update received quantity'; end if;
  if exists(select 1 from public.erp_purchase_receipts where id='receipt-rollback')
     or exists(select 1 from public.inventory_transactions where reference_id='receipt-rollback') then raise exception 'failed receipt left partial state'; end if;

  perform set_config('request.jwt.claim.sub',other_actor::text,true);
  rejected:=false;
  begin
    perform public.create_purchase_order_with_lines_backend('po-rc437-cross','tenant-a',business,'branch-a','PO-CROSS','supplier-a',0,0,null,lines);
  exception when others then if sqlerrm='PURCHASE_ORDER_ROLE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-tenant order creation must be rejected'; end if;
  if has_function_privilege('anon','public.create_purchase_order_with_lines_backend(character varying,character varying,uuid,character varying,character varying,character varying,numeric,numeric,text,jsonb)','EXECUTE') then raise exception 'anon must not execute order creation'; end if;
  if has_function_privilege('anon','public.receive_purchase_stock_with_order_line_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE') then raise exception 'anon must not execute line-aware receipt'; end if;
  if has_function_privilege('authenticated','public.receive_purchase_stock_with_order_line_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE') then raise exception 'authenticated must not execute line-aware receipt'; end if;
  if has_function_privilege('service_role','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE') then raise exception 'service_role must not bypass order-line wrapper'; end if;
end;
$test$;
select 'RC437/RC438 purchase-order line integration: PASS' as result;
