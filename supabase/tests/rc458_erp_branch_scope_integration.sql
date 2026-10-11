-- RC458 integration: prove branch and organization scope on purchase operations.
do $rc458$
declare
  actor_a uuid := 'a4580000-0000-0000-0000-000000000001';
  actor_b uuid := 'a4580000-0000-0000-0000-000000000002';
  actor_c uuid := 'a4580000-0000-0000-0000-000000000003';
  biz uuid := 'b4580000-0000-0000-0000-000000000001';
  product uuid := 'c4580000-0000-0000-0000-000000000001';
  result jsonb;
  rejected boolean;
begin
  insert into public.businesses(id,tenant_id,status,organization_id)
  values(biz,'tenant-1','ACTIVE','org-1');
  insert into public.branches(id,tenant_id,business_id,organization_id,status) values
    ('rc458-branch-a','tenant-1',biz,'org-1','ACTIVE'),
    ('rc458-branch-b','tenant-1',biz,'org-1','ACTIVE');
  insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,organization_id,role,status) values
    ('rc458-m-a',actor_a,'tenant-1',biz,'rc458-branch-a','org-1','MANAGER','ACTIVE'),
    ('rc458-m-b',actor_b,'tenant-1',biz,'rc458-branch-b','org-1','MANAGER','ACTIVE'),
    ('rc458-m-c',actor_c,'tenant-1',biz,'rc458-branch-b','org-other','MANAGER','ACTIVE');
  insert into public.catalog_items(id,tenant_id,business_id,status) values(product,'tenant-1',biz,'ACTIVE');
  insert into public.warehouses(id,tenant_id,business_id,branch_id,status) values
    ('rc458-warehouse-a','tenant-1',biz,'rc458-branch-a','ACTIVE'),
    ('rc458-warehouse-b','tenant-1',biz,'rc458-branch-b','ACTIVE');
  insert into public.erp_purchase_orders(
    id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,created_by
  ) values('rc458-po-branch-b-001','tenant-1',biz,'rc458-branch-b','RC458-PO-B-001','supplier-1',10,0,0,'DRAFT',actor_b);
  insert into public.erp_purchase_order_lines(
    id,tenant_id,business_id,purchase_order_id,line_number,product_id,ordered_quantity,received_quantity,unit_cost,description
  ) values('rc458-po-branch-b-001-line-1','tenant-1',biz,'rc458-po-branch-b-001',1,product,5,0,2,'test line');

  -- Branch A cannot create a purchase order in branch B.
  rejected := false;
  begin
    perform public.create_purchase_order_with_lines_backend(
      'rc458-po-created-by-a-001','tenant-1',biz,'rc458-branch-b','RC458-PO-A-B-001','supplier-1',0,0,null,
      jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'unit_cost',2)),actor_a
    );
    raise exception 'TEST_FAILED: branch A created a branch B purchase order';
  exception when others then
    if sqlerrm <> 'PURCHASE_ORDER_BRANCH_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'branch A purchase-order creation was not blocked'; end if;
  result := public.create_purchase_order_with_lines_backend(
    'rc458-po-created-by-b-001','tenant-1',biz,'rc458-branch-b','RC458-PO-B-B-001','supplier-1',0,0,null,
    jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1,'unit_cost',2)),actor_b
  );
  if coalesce((result->>'success')::boolean,false) is not true
     or result->'order'->>'branch_id' <> 'rc458-branch-b' then
    raise exception 'branch B could not create a purchase order in its own branch';
  end if;

  -- Branch A cannot change lines on branch B order; branch B can.
  rejected := false;
  begin
    perform public.set_purchase_order_lines_backend(
      'rc458-po-branch-b-001','tenant-1',biz,
      jsonb_build_array(jsonb_build_object('product_id',product,'ordered_quantity',5,'unit_cost',2,'description','test line')),
      actor_a
    );
    raise exception 'TEST_FAILED: branch A edited branch B order lines';
  exception when others then
    if sqlerrm <> 'PURCHASE_ORDER_LINES_BRANCH_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'branch A line edit was not blocked'; end if;
  perform public.set_purchase_order_lines_backend(
    'rc458-po-branch-b-001','tenant-1',biz,
    jsonb_build_array(jsonb_build_object('product_id',product,'ordered_quantity',5,'unit_cost',2,'description','test line')),
    actor_b
  );

  -- Status transition must use the authenticated actor and the order's branch.
  perform pg_catalog.set_config('request.jwt.claim.sub',actor_a::text,true);
  rejected := false;
  begin
    perform public.update_purchase_order_status_backend('rc458-po-branch-b-001','SUBMITTED');
    raise exception 'TEST_FAILED: branch A transitioned branch B order';
  exception when others then
    if sqlerrm <> 'PURCHASE_ORDER_BRANCH_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'branch A status transition was not blocked'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',actor_b::text,true);
  result := public.update_purchase_order_status_backend('rc458-po-branch-b-001','SUBMITTED');
  if result->'order'->>'status' <> 'APPROVED' then raise exception 'branch B could not submit its own order'; end if;

  -- A privileged role in branch A must not elevate a lower-privilege branch B membership.
  insert into public.erp_purchase_orders(
    id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,created_by
  ) values('po-approval-branch-b','tenant-1',biz,'branch-b','PO-B-APPROVAL','supplier-1',6000,0,0,'DRAFT',actor_b);
  insert into public.erp_purchase_order_lines(
    id,tenant_id,business_id,purchase_order_id,line_number,product_id,ordered_quantity,received_quantity,unit_cost,description
  ) values('po-approval-branch-b-line-1','tenant-1',biz,'po-approval-branch-b',1,product,3000,0,2,'approval scope test');
  perform pg_catalog.set_config('request.jwt.claim.sub',actor_b::text,true);
  result := public.update_purchase_order_status_backend('po-approval-branch-b','SUBMITTED');
  if result->'order'->>'status' <> 'PENDING_APPROVAL' then
    raise exception 'high-value branch B order must require approval';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',actor_d::text,true);
  rejected := false;
  begin
    perform public.update_purchase_order_status_backend('po-approval-branch-b','APPROVED');
    raise exception 'TEST_FAILED: branch A ADMIN elevated branch B EMPLOYEE membership to approve';
  exception when others then
    if sqlerrm <> 'INVALID_STATUS_TRANSITION' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-branch approval privilege escalation was not blocked'; end if;

  -- Organization mismatch is denied even when the branch ID matches.
  rejected := false;
  begin
    perform public.set_purchase_order_lines_backend(
      'rc458-po-branch-b-001','tenant-1',biz,
      jsonb_build_array(jsonb_build_object('product_id',product,'ordered_quantity',5,'unit_cost',2,'description','test line')),
      actor_c
    );
    raise exception 'TEST_FAILED: mismatched organization edited purchase order';
  exception when others then
    if sqlerrm <> 'PURCHASE_ORDER_LINES_BRANCH_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'organization mismatch was not blocked'; end if;

  -- Receiving must bind to the warehouse/order branch before idempotent replay checks.
  rejected := false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend(
      'rc458-rcv-branch-a-denied','tenant-1',biz,'rc458-po-branch-b-001','RC458-RCV-B-001','rc458-warehouse-b',product,1,2,actor_a
    );
    raise exception 'TEST_FAILED: branch A received into branch B warehouse';
  exception when others then
    if sqlerrm <> 'PURCHASE_RECEIVING_BRANCH_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'branch A receiving was not blocked'; end if;

  result := public.receive_purchase_stock_with_order_line_backend(
    'rc458-rcv-branch-b-001','tenant-1',biz,'rc458-po-branch-b-001','RC458-RCV-B-001','rc458-warehouse-b',product,1,2,actor_b
  );
  if coalesce((result->>'success')::boolean,false) is not true then raise exception 'branch B receiving failed'; end if;

  -- Purchasing remains an authorized role for receipts, but only within its own branch.
  result := public.receive_purchase_stock_with_order_line_backend(
    'rcv-purchasing-b-001','tenant-1',biz,'po-branch-b-001','RCV-B-PURCHASING-001','warehouse-b',product,1,2,actor_e
  );
  if coalesce((result->>'success')::boolean,false) is not true then
    raise exception 'branch-scoped PURCHASING role could not receive an approved purchase order';
  end if;

  -- A receipt replay cannot bypass branch checks merely because the receipt already exists.
  rejected := false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend(
      'rc458-rcv-branch-a-replay','tenant-1',biz,'rc458-po-branch-b-001','RC458-RCV-B-001','rc458-warehouse-b',product,1,2,actor_a
    );
    raise exception 'TEST_FAILED: branch A replayed branch B receipt';
  exception when others then
    if sqlerrm <> 'PURCHASE_RECEIVING_BRANCH_FORBIDDEN' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-branch receipt replay was not blocked'; end if;

  -- A branch-specific order cannot be received into a different branch's warehouse.
  rejected := false;
  begin
    perform public.receive_purchase_stock_with_order_line_backend(
      'rc458-rcv-wrong-warehouse','tenant-1',biz,'rc458-po-branch-b-001','RC458-RCV-B-WRONG','rc458-warehouse-a',product,1,2,actor_b
    );
    raise exception 'TEST_FAILED: branch B order received into branch A warehouse';
  exception when others then
    if sqlerrm <> 'PURCHASE_ORDER_WAREHOUSE_BRANCH_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'cross-branch warehouse receiving was not blocked'; end if;
end;
$rc458$;
