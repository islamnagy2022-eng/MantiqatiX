begin;
insert into public.user_memberships(user_id,tenant_id,business_id,role,status,branch_id) values
 ('11111111-1111-4111-8111-111111111111','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE',null);
insert into public.branches(id,tenant_id,business_id,name,code,status) values
 ('branch-a','tenant-a','22222222-2222-4222-8222-222222222222','Branch A','A','ACTIVE')
 on conflict(id) do nothing;
insert into public.erp_suppliers(id,tenant_id,business_id,branch_id,supplier_code,name_ar,status,created_by)
values ('supplier-line-test','tenant-a','22222222-2222-4222-8222-222222222222',null,'SUP-LINE','Supplier for line test','ACTIVE','11111111-1111-4111-8111-111111111111')
on conflict(id) do nothing;
insert into public.catalog_items(id,tenant_id,business_id,branch_id,status)
values ('66666666-6666-4666-8666-666666666666','tenant-a','22222222-2222-4222-8222-222222222222',null,'ACTIVE'),
 ('88888888-8888-4888-8888-888888888888','tenant-b','99999999-9999-4999-8999-999999999999',null,'ACTIVE'),
 ('77777777-7777-4777-8777-777777777777','tenant-a','22222222-2222-4222-8222-222222222222',null,'ACTIVE')
on conflict(id) do nothing;
insert into public.warehouses(id,tenant_id,business_id,branch_id,status)
values ('warehouse-global','tenant-a','22222222-2222-4222-8222-222222222222',null,'ACTIVE')
on conflict(id) do nothing;
set local role service_role;
do $$
declare
  actor uuid := '11111111-1111-4111-8111-111111111111';
  biz uuid := '22222222-2222-4222-8222-222222222222';
  args jsonb := jsonb_build_object(
    'p_id','po-lines-test-0001','p_tenant_id','tenant-a','p_business_id','22222222-2222-4222-8222-222222222222',
    'p_branch_id',null,'p_order_number','PO-LINES-001','p_supplier_id','supplier-line-test',
    'p_tax_amount',2,'p_discount_amount',1,'p_reason','RC465 integration',
    'p_lines',jsonb_build_array(jsonb_build_object('product_id','66666666-6666-4666-8666-666666666666','quantity',3,'unit_cost',5))
  );
  result jsonb;
  row_count integer;
  ledger_count integer;
  line public.erp_purchase_order_lines%rowtype;
begin
  if has_function_privilege('authenticated','public.erp_purchase_order_create_with_lines_backend(uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.erp_purchase_order_create_with_lines_backend(uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.erp_purchase_stock_receive_with_lines_backend(uuid,jsonb)','EXECUTE') then
    raise exception 'RC465_RPC_MUST_REMAIN_SERVICE_ROLE_ONLY';
  end if;

  result := public.erp_purchase_order_create_with_lines_backend(actor,args);
  if result->>'success'<>'true' or result->>'idempotent'<>'false' then raise exception 'RC465_ORDER_CREATE_FAILED'; end if;
  if (result#>>'{order,total_amount}')::numeric<>16 then raise exception 'RC465_HEADER_TOTAL_NOT_DERIVED_FROM_LINES'; end if;
  select count(*) into row_count from public.erp_purchase_order_lines where purchase_order_id='po-lines-test-0001';
  if row_count<>1 then raise exception 'RC465_ORDER_LINE_NOT_CREATED'; end if;
  select * into line from public.erp_purchase_order_lines where purchase_order_id='po-lines-test-0001';
  if line.ordered_quantity<>3 or line.unit_cost<>5 or line.line_total<>15 or line.received_quantity<>0 then
    raise exception 'RC465_ORDER_LINE_TOTAL_OR_QUANTITY_INVALID';
  end if;

  result := public.erp_purchase_order_create_with_lines_backend(actor,args);
  if result->>'idempotent'<>'true' then raise exception 'RC465_ORDER_RETRY_NOT_IDEMPOTENT'; end if;
  select count(*) into row_count from public.erp_purchase_order_lines where purchase_order_id='po-lines-test-0001';
  if row_count<>1 then raise exception 'RC465_RETRY_DUPLICATED_ORDER_LINES'; end if;

  begin
    perform public.erp_purchase_order_create_with_lines_backend(actor,
      args || jsonb_build_object('p_id','po-cross-product-0001','p_order_number','PO-CROSS',
        'p_lines',jsonb_build_array(jsonb_build_object('product_id','88888888-8888-4888-8888-888888888888','quantity',1,'unit_cost',1))));
    raise exception 'RC465_CROSS_TENANT_PRODUCT_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_PRODUCT_SCOPE_INVALID%' then raise; end if;
  end;
  if exists(select 1 from public.erp_purchase_orders where id='po-cross-product-0001') then
    raise exception 'RC465_INVALID_PRODUCT_MUTATED_ORDER';
  end if;

  update public.erp_purchase_orders set status='SUBMITTED' where id='po-lines-test-0001';
  result := public.erp_purchase_stock_receive_with_lines_backend(actor,jsonb_build_object(
    'p_id','rcv-lines-test-0001','p_tenant_id','tenant-a','p_business_id',biz,
    'p_purchase_order_id','po-lines-test-0001','p_receipt_number','RCV-LINES-001',
    'p_warehouse_id','warehouse-global','p_product_id','66666666-6666-4666-8666-666666666666',
    'p_received_quantity',2,'p_unit_cost',5));
  if result->>'success'<>'true' or result->>'order_status'<>'PARTIALLY_RECEIVED' then raise exception 'RC465_PARTIAL_RECEIPT_FAILED'; end if;
  select * into line from public.erp_purchase_order_lines where purchase_order_id='po-lines-test-0001';
  if line.received_quantity<>2 then raise exception 'RC465_RECEIVED_QUANTITY_NOT_LINKED_TO_ORDER_LINE'; end if;
  if (select quantity_on_hand from public.stock_balances where tenant_id='tenant-a' and business_id=biz and warehouse_id='warehouse-global' and product_id='66666666-6666-4666-8666-666666666666')<>2 then
    raise exception 'RC465_RECEIPT_DID_NOT_UPDATE_STOCK_BALANCE';
  end if;

  result := public.erp_purchase_stock_receive_with_lines_backend(actor,jsonb_build_object(
    'p_id','rcv-lines-test-0001','p_tenant_id','tenant-a','p_business_id',biz,
    'p_purchase_order_id','po-lines-test-0001','p_receipt_number','RCV-LINES-001',
    'p_warehouse_id','warehouse-global','p_product_id','66666666-6666-4666-8666-666666666666',
    'p_received_quantity',2,'p_unit_cost',5));
  if result->>'idempotent'<>'true' then raise exception 'RC465_RECEIPT_RETRY_NOT_IDEMPOTENT'; end if;
  select received_quantity into row_count from public.erp_purchase_order_lines where purchase_order_id='po-lines-test-0001';
  if row_count<>2 then raise exception 'RC465_RECEIPT_RETRY_DOUBLE_COUNTED'; end if;
  select count(*) into ledger_count from public.erp_purchase_receipt_idempotency where tenant_id='tenant-a' and business_id=biz and receipt_id='rcv-lines-test-0001';
  if ledger_count<>1 then raise exception 'RC465_RECEIPT_IDEMPOTENCY_LEDGER_MISSING'; end if;

  begin
    perform public.erp_purchase_stock_receive_with_lines_backend(actor,jsonb_build_object(
      'p_id','rcv-lines-test-0001','p_tenant_id','tenant-a','p_business_id',biz,
      'p_purchase_order_id','po-lines-test-0001','p_receipt_number','RCV-LINES-CONFLICT',
      'p_warehouse_id','warehouse-global','p_product_id','66666666-6666-4666-8666-666666666666',
      'p_received_quantity',2,'p_unit_cost',5));
    raise exception 'RC465_RECEIPT_IDEMPOTENCY_CONFLICT_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_RECEIPT_IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;
  if (select quantity_on_hand from public.stock_balances where tenant_id='tenant-a' and business_id=biz and warehouse_id='warehouse-global' and product_id='66666666-6666-4666-8666-666666666666')<>2 then
    raise exception 'RC465_RECEIPT_IDEMPOTENCY_CONFLICT_MUTATED_STOCK';
  end if;

  begin
    perform public.erp_purchase_stock_receive_with_lines_backend(actor,jsonb_build_object(
      'p_id','rcv-lines-test-0002','p_tenant_id','tenant-a','p_business_id',biz,
      'p_purchase_order_id','po-lines-test-0001','p_receipt_number','RCV-LINES-002',
      'p_warehouse_id','warehouse-global','p_product_id','66666666-6666-4666-8666-666666666666',
      'p_received_quantity',2,'p_unit_cost',5));
    raise exception 'RC465_OVER_RECEIPT_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_PURCHASE_ORDER_RECEIVE_LIMIT_EXCEEDED%' then raise; end if;
  end;
  begin
    perform public.erp_purchase_stock_receive_with_lines_backend(actor,jsonb_build_object(
      'p_id','rcv-lines-test-0003','p_tenant_id','tenant-a','p_business_id',biz,
      'p_purchase_order_id','po-lines-test-0001','p_receipt_number','RCV-LINES-003',
      'p_warehouse_id','warehouse-global','p_product_id','77777777-7777-4777-8777-777777777777',
      'p_received_quantity',1,'p_unit_cost',1));
    raise exception 'RC465_PRODUCT_NOT_ON_ORDER_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_PURCHASE_ORDER_LINE_NOT_FOUND%' then raise; end if;
  end;
end $$;
reset role;
rollback;
