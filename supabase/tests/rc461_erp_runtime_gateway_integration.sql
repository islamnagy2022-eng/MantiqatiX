begin;
insert into public.user_memberships(user_id,tenant_id,business_id,role,status) values
 ('11111111-1111-4111-8111-111111111111','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE');
insert into public.user_memberships(user_id,tenant_id,business_id,role,status,branch_id) values
 ('44444444-4444-4444-8444-444444444444','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE','branch-a');
insert into public.erp_purchase_orders(id,tenant_id,business_id,branch_id) values
 ('po-existing','tenant-a','22222222-2222-4222-8222-222222222222',null),
 ('po-other-branch','tenant-a','22222222-2222-4222-8222-222222222222','branch-b');
insert into public.warehouses(id,tenant_id,business_id,branch_id,status) values
 ('warehouse-a','tenant-a','22222222-2222-4222-8222-222222222222','branch-a','ACTIVE'),
 ('warehouse-b','tenant-a','22222222-2222-4222-8222-222222222222','branch-b','ACTIVE');
insert into public.catalog_items(id,tenant_id,business_id,branch_id,status) values
 ('55555555-5555-4555-8555-555555555555','tenant-a','22222222-2222-4222-8222-222222222222','branch-b','ACTIVE'),
 ('66666666-6666-4666-8666-666666666666','tenant-a','22222222-2222-4222-8222-222222222222','branch-a','ACTIVE');
insert into public.erp_stock_transfers(id,tenant_id,business_id,from_warehouse_id,to_warehouse_id) values
 ('tr-existing','tenant-a','22222222-2222-4222-8222-222222222222','warehouse-a','warehouse-b');
set local role service_role;
do $$
declare result jsonb; actor uuid := '11111111-1111-4111-8111-111111111111'; branch_actor uuid := '44444444-4444-4444-8444-444444444444'; biz uuid := '22222222-2222-4222-8222-222222222222';
begin
  if has_function_privilege('authenticated','public.erp_runtime_execute(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.erp_runtime_execute(uuid,text,jsonb)','EXECUTE') then
    raise exception 'RC461_GATEWAY_MUST_REMAIN_SERVICE_ROLE_ONLY';
  end if;
  begin
    perform public.erp_runtime_execute('33333333-3333-4333-8333-333333333333','create_purchase_order',
      jsonb_build_object('p_id','po-denied','p_tenant_id','tenant-a','p_business_id',biz,'p_order_number','DENIED','p_supplier_id','s1','p_total_amount',1));
    raise exception 'RC461_NON_MEMBER_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_MEMBERSHIP_REQUIRED%' then raise; end if;
  end;
  result := public.erp_runtime_execute(actor,'create_purchase_order',
    jsonb_build_object('p_id','po-new','p_tenant_id','tenant-a','p_business_id',biz,'p_branch_id',null,'p_order_number','PO-1','p_supplier_id','supplier-1','p_total_amount',100,'p_tax_amount',0,'p_discount_amount',0,'p_reason','test'));
  if result->>'actor' <> actor::text or result->>'operation' <> 'create_purchase_order' then
    raise exception 'RC461_ACTOR_CONTEXT_NOT_PROPAGATED';
  end if;
  begin
    perform public.erp_runtime_execute(branch_actor,'update_purchase_order_status',
      jsonb_build_object('p_order_id','po-other-branch','p_target_status','SUBMITTED'));
    raise exception 'RC461_CROSS_BRANCH_ORDER_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.erp_runtime_execute(actor,'receive_purchase_stock',
      jsonb_build_object('p_id','rcv-missing-order','p_tenant_id','tenant-a','p_business_id',biz,'p_purchase_order_id','po-not-in-scope','p_receipt_number','RCV-X','p_warehouse_id','warehouse-a','p_product_id','66666666-6666-4666-8666-666666666666','p_received_quantity',1,'p_unit_cost',1));
    raise exception 'RC461_RECEIPT_WITHOUT_SCOPED_ORDER_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_PURCHASE_ORDER_SCOPE_INVALID%' then raise; end if;
  end;
  begin
    perform public.erp_runtime_execute(branch_actor,'receive_purchase_stock',
      jsonb_build_object('p_id','rcv-cross-branch-order','p_tenant_id','tenant-a','p_business_id',biz,'p_purchase_order_id','po-other-branch','p_receipt_number','RCV-Y','p_warehouse_id','warehouse-a','p_product_id','66666666-6666-4666-8666-666666666666','p_received_quantity',1,'p_unit_cost',1));
    raise exception 'RC461_CROSS_BRANCH_PURCHASE_ORDER_RECEIPT_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.erp_runtime_execute(branch_actor,'create_stock_transfer',
      jsonb_build_object('p_id','tr-cross-branch','p_tenant_id','tenant-a','p_business_id',biz,'p_transfer_number','TR-1','p_from_warehouse_id','warehouse-b','p_to_warehouse_id','warehouse-b','p_product_id','55555555-5555-4555-8555-555555555555','p_quantity',1));
    raise exception 'RC461_CROSS_BRANCH_TRANSFER_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.erp_runtime_execute(branch_actor,'create_stock_transfer',
      jsonb_build_object('p_id','tr-cross-product','p_tenant_id','tenant-a','p_business_id',biz,'p_transfer_number','TR-2','p_from_warehouse_id','warehouse-a','p_to_warehouse_id','warehouse-a','p_product_id','55555555-5555-4555-8555-555555555555','p_quantity',1));
    raise exception 'RC461_CROSS_BRANCH_PRODUCT_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.erp_runtime_execute(actor,'update_purchase_order_status',
      jsonb_build_object('p_order_id','po-existing','p_target_status','APPROVED'));
    raise exception 'RC461_MANAGER_APPROVAL_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_PURCHASE_APPROVAL_ROLE_REQUIRED%' then raise; end if;
  end;
  update public.user_memberships set role='OWNER' where user_id=actor and tenant_id='tenant-a' and business_id=biz;
  result := public.erp_runtime_execute(actor,'update_purchase_order_status',
    jsonb_build_object('p_order_id','po-existing','p_target_status','APPROVED'));
  if result->>'actor' <> actor::text then raise exception 'RC461_OWNER_ACTOR_NOT_PROPAGATED'; end if;
  begin
    perform public.erp_runtime_execute(actor,'arbitrary_sql',jsonb_build_object());
    raise exception 'RC461_UNKNOWN_OPERATION_WAS_ALLOWED';
  exception when others then
    if sqlerrm not like '%ERP_OPERATION_NOT_ALLOWED%' then raise; end if;
  end;
end $$;
reset role;
rollback;
