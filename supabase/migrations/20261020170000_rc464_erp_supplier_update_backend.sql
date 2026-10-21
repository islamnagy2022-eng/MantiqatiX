-- RC464: scoped supplier update/status lifecycle for ERP procurement.
create or replace function public.erp_supplier_update_backend(
  p_actor_user_id uuid,
  p_arguments jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tenant_id text := nullif(p_arguments->>'p_tenant_id','');
  v_business_id uuid := nullif(p_arguments->>'p_business_id','')::uuid;
  v_supplier_id text := nullif(p_arguments->>'p_id','');
  v_role text;
  v_member_branch text;
  v_row public.erp_suppliers%rowtype;
  v_name_ar text;
  v_supplier_code text;
  v_status text;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_arguments is null or jsonb_typeof(p_arguments) <> 'object' then raise exception 'INVALID_ARGUMENTS'; end if;
  if coalesce(v_tenant_id,'')='' or v_business_id is null or coalesce(v_supplier_id,'')='' then
    raise exception 'ERP_SUPPLIER_REQUIRED_FIELDS';
  end if;

  select * into v_row
  from public.erp_suppliers s
  where s.id=v_supplier_id and s.tenant_id::text=v_tenant_id and s.business_id=v_business_id
  for update;
  if not found then raise exception 'ERP_SUPPLIER_SCOPE_INVALID'; end if;

  select upper(m.role),m.branch_id::text into v_role,v_member_branch
  from public.user_memberships m
  where m.user_id=p_actor_user_id and m.tenant_id::text=v_tenant_id
    and m.business_id=v_business_id and m.status='ACTIVE'
  order by case upper(m.role) when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3 when 'MANAGER' then 4 else 5 end,
           case when m.branch_id is null then 0 else 1 end
  limit 1;
  if v_role is null then raise exception 'ERP_MEMBERSHIP_REQUIRED'; end if;
  if v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
    raise exception 'ERP_SUPPLIER_UPDATE_ROLE_REQUIRED';
  end if;
  if v_member_branch is not null and v_row.branch_id::text is distinct from v_member_branch then
    raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
  end if;
  if p_arguments ? 'p_branch_id'
     and nullif(p_arguments->>'p_branch_id','') is distinct from v_row.branch_id::text then
    raise exception 'ERP_SUPPLIER_BRANCH_SCOPE_INVALID';
  end if;

  v_name_ar := case when p_arguments ? 'p_name_ar'
    then btrim(coalesce(p_arguments->>'p_name_ar','')) else v_row.name_ar end;
  if coalesce(v_name_ar,'')='' then raise exception 'ERP_SUPPLIER_REQUIRED_FIELDS'; end if;
  v_supplier_code := case when p_arguments ? 'p_supplier_code'
    then nullif(btrim(p_arguments->>'p_supplier_code'),'') else v_row.supplier_code end;
  v_status := upper(case when p_arguments ? 'p_status'
    then coalesce(p_arguments->>'p_status','') else v_row.status end);
  if v_status not in ('ACTIVE','INACTIVE','ARCHIVED') then raise exception 'ERP_SUPPLIER_STATUS_INVALID'; end if;

  update public.erp_suppliers s set
    supplier_code=v_supplier_code,
    name_ar=v_name_ar,
    name_en=case when p_arguments ? 'p_name_en' then nullif(btrim(p_arguments->>'p_name_en'),'') else s.name_en end,
    contact_name=case when p_arguments ? 'p_contact_name' then nullif(btrim(p_arguments->>'p_contact_name'),'') else s.contact_name end,
    phone=case when p_arguments ? 'p_phone' then nullif(btrim(p_arguments->>'p_phone'),'') else s.phone end,
    email=case when p_arguments ? 'p_email' then nullif(lower(btrim(p_arguments->>'p_email')),'') else s.email end,
    tax_number=case when p_arguments ? 'p_tax_number' then nullif(btrim(p_arguments->>'p_tax_number'),'') else s.tax_number end,
    payment_terms=case when p_arguments ? 'p_payment_terms' then nullif(btrim(p_arguments->>'p_payment_terms'),'') else s.payment_terms end,
    notes=case when p_arguments ? 'p_notes' then nullif(btrim(p_arguments->>'p_notes'),'') else s.notes end,
    status=v_status,
    updated_at=now()
  where s.id=v_supplier_id and s.tenant_id::text=v_tenant_id and s.business_id=v_business_id
  returning * into v_row;

  return jsonb_build_object('success',true,'supplier',to_jsonb(v_row));
exception
  when unique_violation then raise exception 'ERP_SUPPLIER_CODE_ALREADY_EXISTS';
end;
$function$;

revoke all on function public.erp_supplier_update_backend(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.erp_supplier_update_backend(uuid,jsonb) to service_role;
