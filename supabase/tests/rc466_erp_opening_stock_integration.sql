begin;
insert into public.user_memberships values
 ('11111111-1111-4111-8111-111111111111','tenant-a','22222222-2222-4222-8222-222222222222','branch-a','MANAGER','ACTIVE'),
 ('33333333-3333-4333-8333-333333333333','tenant-a','22222222-2222-4222-8222-222222222222',null,'MANAGER','ACTIVE');
insert into public.warehouses values
 ('warehouse-a','tenant-a','22222222-2222-4222-8222-222222222222','branch-a','ACTIVE'),
 ('warehouse-b','tenant-a','22222222-2222-4222-8222-222222222222','branch-b','ACTIVE');
insert into public.catalog_items values
 ('44444444-4444-4444-8444-444444444444','tenant-a','22222222-2222-4222-8222-222222222222',null,'ACTIVE');
set local role service_role;
do $$
declare result jsonb; args jsonb := jsonb_build_object(
 'p_id','opening-0001','p_tenant_id','tenant-a','p_business_id','22222222-2222-4222-8222-222222222222',
 'p_warehouse_id','warehouse-a','p_product_id','44444444-4444-4444-8444-444444444444',
 'p_quantity',12,'p_unit_cost',4.25,'p_reference_id','OPEN-2026-001');
begin
 if has_function_privilege('authenticated','public.erp_opening_stock_backend(uuid,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.erp_opening_stock_backend(uuid,jsonb)','EXECUTE') then
   raise exception 'RC466_RPC_MUST_REMAIN_SERVICE_ROLE_ONLY';
 end if;
 begin
   perform public.erp_opening_stock_backend('55555555-5555-4555-8555-555555555555',args);
   raise exception 'RC466_NON_MEMBER_WAS_ALLOWED';
 exception when others then if sqlerrm not like '%OPENING_STOCK_ROLE_REQUIRED%' then raise; end if; end;
 begin
   perform public.erp_opening_stock_backend('11111111-1111-4111-8111-111111111111',args||jsonb_build_object('p_warehouse_id','warehouse-b'));
   raise exception 'RC466_CROSS_BRANCH_WAS_ALLOWED';
 exception when others then if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if; end;
 result := public.erp_opening_stock_backend('11111111-1111-4111-8111-111111111111',args);
 if result->>'actor' <> '11111111-1111-4111-8111-111111111111'
    or result->>'quantity' <> '12' or result->>'reference_id' <> 'OPEN-2026-001' then
   raise exception 'RC466_ACTOR_OR_PAYLOAD_NOT_PROPAGATED';
 end if;
 begin
   perform public.erp_opening_stock_backend('33333333-3333-4333-8333-333333333333',args||jsonb_build_object('p_quantity',0));
   raise exception 'RC466_INVALID_QUANTITY_WAS_ALLOWED';
 exception when others then if sqlerrm not like '%INVALID_OPENING_STOCK%' then raise; end if; end;
end $$;
reset role;
rollback;
