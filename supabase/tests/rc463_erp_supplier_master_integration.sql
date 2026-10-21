begin;
insert into public.user_memberships(user_id,tenant_id,business_id,role,status,branch_id) values
 ('11111111-1111-4111-8111-111111111111','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE',null),
 ('44444444-4444-4444-8444-444444444444','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE','branch-a');
insert into public.branches(id,tenant_id,business_id,name,code,status) values
 ('branch-a','tenant-a','22222222-2222-4222-8222-222222222222','Branch A','A','ACTIVE'),
 ('branch-b','tenant-a','22222222-2222-4222-8222-222222222222','Branch B','B','ACTIVE');
set local role service_role;
do $$
declare result jsonb; actor uuid := '11111111-1111-4111-8111-111111111111'; branch_actor uuid := '44444444-4444-4444-8444-444444444444'; biz uuid := '22222222-2222-4222-8222-222222222222';
begin
  if has_function_privilege('authenticated','public.erp_supplier_create_backend(uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.erp_supplier_create_backend(uuid,jsonb)','EXECUTE') then
    raise exception 'RC463_SUPPLIER_RPC_MUST_REMAIN_SERVICE_ROLE_ONLY';
  end if;
  if has_table_privilege('authenticated','public.erp_suppliers','SELECT') or has_table_privilege('anon','public.erp_suppliers','SELECT') then
    raise exception 'RC463_SUPPLIER_TABLE_MUST_REMAIN_BACKEND_ONLY';
  end if;
  result := public.erp_supplier_create_backend(actor,jsonb_build_object(
    'p_id','sup-a','p_tenant_id','tenant-a','p_business_id',biz,'p_branch_id',null,
    'p_supplier_code','SUP-001','p_name_ar','مورد تجريبي','p_phone','01000000000'));
  if result->>'success' <> 'true' or result#>>'{supplier,id}' <> 'sup-a' then raise exception 'RC463_SUPPLIER_CREATE_FAILED'; end if;
  result := public.erp_supplier_create_backend(actor,jsonb_build_object(
    'p_id','sup-a','p_tenant_id','tenant-a','p_business_id',biz,'p_branch_id',null,
    'p_supplier_code','SUP-001','p_name_ar','مورد تجريبي','p_phone','01000000000'));
  if result#>>'{supplier,id}' <> 'sup-a' then raise exception 'RC463_IDEMPOTENT_RETRY_FAILED'; end if;
  begin
    perform public.erp_supplier_create_backend(branch_actor,jsonb_build_object(
      'p_id','sup-cross','p_tenant_id','tenant-a','p_business_id',biz,'p_branch_id','branch-b',
      'p_supplier_code','SUP-X','p_name_ar','مورد فرع آخر'));
    raise exception 'RC463_CROSS_BRANCH_SUPPLIER_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if; end;
  result := public.erp_supplier_create_backend(branch_actor,jsonb_build_object(
    'p_id','sup-branch-a','p_tenant_id','tenant-a','p_business_id',biz,'p_branch_id','branch-a',
    'p_supplier_code','SUP-A','p_name_ar','مورد الفرع أ'));
  if result#>>'{supplier,branch_id}' <> 'branch-a' then raise exception 'RC463_BRANCH_SUPPLIER_CREATE_FAILED'; end if;
  begin
    perform public.erp_supplier_create_backend(actor,jsonb_build_object(
      'p_id','sup-duplicate-code','p_tenant_id','tenant-a','p_business_id',biz,'p_branch_id',null,
      'p_supplier_code','SUP-001','p_name_ar','مورد مكرر'));
    raise exception 'RC463_DUPLICATE_CODE_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_SUPPLIER_CODE_ALREADY_EXISTS%' then raise; end if; end;
  begin
    perform public.erp_supplier_create_backend('33333333-3333-4333-8333-333333333333',jsonb_build_object(
      'p_id','sup-nonmember','p_tenant_id','tenant-a','p_business_id',biz,'p_name_ar','غير عضو'));
    raise exception 'RC463_NONMEMBER_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_MEMBERSHIP_REQUIRED%' then raise; end if; end;
end $$;
reset role;
rollback;
