begin;
insert into public.branches(id,tenant_id,business_id,name,code,status) values
 ('branch-a','tenant-a','22222222-2222-4222-8222-222222222222','Branch A','A','ACTIVE'),
 ('branch-b','tenant-a','22222222-2222-4222-8222-222222222222','Branch B','B','ACTIVE');
insert into public.user_memberships(user_id,tenant_id,business_id,role,status,branch_id) values
 ('11111111-1111-4111-8111-111111111111','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE',null),
 ('44444444-4444-4444-8444-444444444444','tenant-a','22222222-2222-4222-8222-222222222222','MANAGER','ACTIVE','branch-a'),
 ('33333333-3333-4333-8333-333333333333','tenant-a','22222222-2222-4222-8222-222222222222','STAFF','ACTIVE','branch-a');
insert into public.erp_suppliers(id,tenant_id,business_id,branch_id,supplier_code,name_ar,status,created_by) values
 ('sup-global','tenant-a','22222222-2222-4222-8222-222222222222',null,'SUP-GLOBAL','مورد عام','ACTIVE','11111111-1111-4111-8111-111111111111'),
 ('sup-branch-a','tenant-a','22222222-2222-4222-8222-222222222222','branch-a','SUP-A','مورد الفرع أ','ACTIVE','11111111-1111-4111-8111-111111111111'),
 ('sup-branch-b','tenant-a','22222222-2222-4222-8222-222222222222','branch-b','SUP-B','مورد الفرع ب','ACTIVE','11111111-1111-4111-8111-111111111111'),
 ('sup-other-tenant','tenant-b','99999999-9999-4999-8999-999999999999',null,'SUP-OTHER','مورد مؤسسة أخرى','ACTIVE','11111111-1111-4111-8111-111111111111');
set local role service_role;
do $$
declare
  global_actor uuid := '11111111-1111-4111-8111-111111111111';
  branch_actor uuid := '44444444-4444-4444-8444-444444444444';
  staff_actor uuid := '33333333-3333-4333-8333-333333333333';
  business uuid := '22222222-2222-4222-8222-222222222222';
  result jsonb;
begin
  if has_function_privilege('authenticated','public.erp_supplier_update_backend(uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.erp_supplier_update_backend(uuid,jsonb)','EXECUTE') then
    raise exception 'RC464_SUPPLIER_UPDATE_RPC_MUST_REMAIN_SERVICE_ROLE_ONLY';
  end if;
  result := public.erp_supplier_update_backend(global_actor,jsonb_build_object(
    'p_id','sup-global','p_tenant_id','tenant-a','p_business_id',business,
    'p_name_ar','مورد محدث','p_supplier_code','SUP-GLOBAL-2','p_status','INACTIVE'));
  if result#>>'{supplier,name_ar}' <> 'مورد محدث' or result#>>'{supplier,status}' <> 'INACTIVE' then
    raise exception 'RC464_SUPPLIER_UPDATE_FAILED';
  end if;
  result := public.erp_supplier_update_backend(global_actor,jsonb_build_object(
    'p_id','sup-global','p_tenant_id','tenant-a','p_business_id',business,
    'p_name_ar','مورد محدث','p_supplier_code','SUP-GLOBAL-2','p_status','INACTIVE'));
  if result#>>'{supplier,id}' <> 'sup-global' then raise exception 'RC464_REPEATED_UPDATE_FAILED'; end if;
  begin
    perform public.erp_supplier_update_backend(global_actor,jsonb_build_object(
      'p_id','sup-other-tenant','p_tenant_id','tenant-a','p_business_id',business,'p_name_ar','تغيير غير مصرح'));
    raise exception 'RC464_CROSS_TENANT_UPDATE_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_SUPPLIER_SCOPE_INVALID%' then raise; end if; end;
  begin
    perform public.erp_supplier_update_backend(branch_actor,jsonb_build_object(
      'p_id','sup-global','p_tenant_id','tenant-a','p_business_id',business,'p_name_ar','تغيير عام'));
    raise exception 'RC464_BRANCH_ACTOR_UPDATED_GLOBAL_SUPPLIER';
  exception when others then if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if; end;
  begin
    perform public.erp_supplier_update_backend(branch_actor,jsonb_build_object(
      'p_id','sup-branch-b','p_tenant_id','tenant-a','p_business_id',business,'p_name_ar','تغيير فرع آخر'));
    raise exception 'RC464_CROSS_BRANCH_UPDATE_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_BRANCH_SCOPE_REQUIRED%' then raise; end if; end;
  result := public.erp_supplier_update_backend(branch_actor,jsonb_build_object(
    'p_id','sup-branch-a','p_tenant_id','tenant-a','p_business_id',business,
    'p_branch_id','branch-a','p_name_ar','مورد الفرع أ المعدل','p_status','ACTIVE'));
  if result#>>'{supplier,name_ar}' <> 'مورد الفرع أ المعدل' then raise exception 'RC464_BRANCH_SUPPLIER_UPDATE_FAILED'; end if;
  begin
    perform public.erp_supplier_update_backend(global_actor,jsonb_build_object(
      'p_id','sup-branch-a','p_tenant_id','tenant-a','p_business_id',business,'p_status','DELETED'));
    raise exception 'RC464_INVALID_STATUS_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_SUPPLIER_STATUS_INVALID%' then raise; end if; end;
  begin
    perform public.erp_supplier_update_backend(global_actor,jsonb_build_object(
      'p_id','sup-branch-a','p_tenant_id','tenant-a','p_business_id',business,'p_supplier_code','SUP-GLOBAL-2'));
    raise exception 'RC464_DUPLICATE_CODE_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_SUPPLIER_CODE_ALREADY_EXISTS%' then raise; end if; end;
  begin
    perform public.erp_supplier_update_backend(staff_actor,jsonb_build_object(
      'p_id','sup-branch-a','p_tenant_id','tenant-a','p_business_id',business,'p_name_ar','تعديل موظف'));
    raise exception 'RC464_STAFF_UPDATE_WAS_ALLOWED';
  exception when others then if sqlerrm not like '%ERP_SUPPLIER_UPDATE_ROLE_REQUIRED%' then raise; end if; end;
end $$;
reset role;
rollback;
