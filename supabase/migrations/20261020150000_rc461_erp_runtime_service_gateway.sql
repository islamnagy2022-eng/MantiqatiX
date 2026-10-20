-- RC461: authenticated ERP gateway for backend-only ERP tables and mutations.
-- The public tables stay service-role-only. The Edge Function authenticates the caller,
-- and this RPC validates actor membership before invoking the existing audited RPC contracts.
create or replace function public.erp_runtime_execute(
  p_actor_user_id uuid,
  p_operation text,
  p_arguments jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tenant_id text;
  v_business_id uuid;
  v_role text;
  v_member_branch_id text;
  v_record_branch_id text;
  v_purchase_order_branch_id text;
  v_purchase_order_status text;
  v_from_warehouse_id text;
  v_to_warehouse_id text;
  v_supplier_branch_id text;
  v_result jsonb;
  v_target_status text;
  v_row_exists boolean := false;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_arguments is null or jsonb_typeof(p_arguments) <> 'object' then
    raise exception 'INVALID_ARGUMENTS';
  end if;
  if coalesce(p_operation,'') not in (
    'create_purchase_order',
    'update_purchase_order_status',
    'receive_purchase_stock',
    'create_stock_transfer',
    'update_stock_transfer_status',
    'receive_stock_transfer'
  ) then
    raise exception 'ERP_OPERATION_NOT_ALLOWED';
  end if;

  v_target_status := upper(coalesce(p_arguments->>'p_target_status', ''));

  if p_operation in ('create_purchase_order','receive_purchase_stock','create_stock_transfer') then
    v_tenant_id := nullif(p_arguments->>'p_tenant_id','');
    v_business_id := nullif(p_arguments->>'p_business_id','')::uuid;
  elsif p_operation = 'update_purchase_order_status' then
    select tenant_id::text, business_id, branch_id::text into v_tenant_id, v_business_id, v_record_branch_id
      from public.erp_purchase_orders
      where id = p_arguments->>'p_order_id';
    v_row_exists := found;
  else
    select tenant_id::text, business_id, from_warehouse_id::text, to_warehouse_id::text into v_tenant_id, v_business_id, v_from_warehouse_id, v_to_warehouse_id
      from public.erp_stock_transfers
      where id = coalesce(p_arguments->>'p_transfer_id', p_arguments->>'p_id');
    v_row_exists := found;
  end if;

  if p_operation in ('update_purchase_order_status','update_stock_transfer_status','receive_stock_transfer')
     and not v_row_exists then
    raise exception 'ERP_RECORD_NOT_FOUND';
  end if;
  if coalesce(v_tenant_id,'') = '' or v_business_id is null then
    raise exception 'ERP_SCOPE_REQUIRED';
  end if;

  if p_operation = 'receive_purchase_stock' then
    select o.branch_id::text, upper(o.status) into v_purchase_order_branch_id, v_purchase_order_status
      from public.erp_purchase_orders o
      where o.id = p_arguments->>'p_purchase_order_id'
        and o.tenant_id::text = v_tenant_id
        and o.business_id = v_business_id;
    if not found then
      raise exception 'ERP_PURCHASE_ORDER_SCOPE_INVALID';
    end if;
    if coalesce(v_purchase_order_status,'') not in ('SUBMITTED','APPROVED','PARTIALLY_RECEIVED') then
      raise exception 'ERP_PURCHASE_ORDER_NOT_READY_FOR_RECEIPT';
    end if;
  end if;

  select upper(m.role), m.branch_id::text into v_role, v_member_branch_id
  from public.user_memberships m
  where m.user_id = p_actor_user_id
    and m.tenant_id::text = v_tenant_id
    and m.business_id = v_business_id
    and m.status = 'ACTIVE'
  order by case upper(m.role)
    when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3
    when 'MANAGER' then 4 when 'FINANCE_MANAGER' then 5 when 'ACCOUNTANT' then 6
    when 'FINANCE' then 7 when 'EMPLOYEE' then 8 when 'STAFF' then 9 else 99 end,
    case when m.branch_id is null then 0 else 1 end
  limit 1;

  if v_role is null then
    raise exception 'ERP_MEMBERSHIP_REQUIRED';
  end if;

  if p_operation = 'receive_purchase_stock' then
    if v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
      raise exception 'ERP_PURCHASE_RECEIVING_ROLE_REQUIRED';
    end if;
  elsif v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') then
    raise exception 'ERP_OPERATION_ROLE_REQUIRED';
  end if;

  if p_operation = 'update_purchase_order_status'
     and v_target_status = 'APPROVED'
     and v_role not in ('OWNER','BUSINESS_OWNER','ADMIN') then
    raise exception 'ERP_PURCHASE_APPROVAL_ROLE_REQUIRED';
  end if;

  -- Resolve and validate the supplier reference inside the same server-side scope.
  if p_operation = 'create_purchase_order' then
    if nullif(p_arguments->>'p_supplier_id','') is null then
      raise exception 'ERP_SUPPLIER_REQUIRED';
    end if;
    select s.branch_id::text into v_supplier_branch_id
    from public.erp_suppliers s
    where s.id = p_arguments->>'p_supplier_id'
      and s.tenant_id::text = v_tenant_id
      and s.business_id = v_business_id
      and s.status = 'ACTIVE';
    if not found then raise exception 'ERP_SUPPLIER_SCOPE_INVALID'; end if;
    if v_supplier_branch_id is not null
       and v_supplier_branch_id is distinct from nullif(p_arguments->>'p_branch_id','') then
      raise exception 'ERP_SUPPLIER_BRANCH_SCOPE_INVALID';
    end if;
    if nullif(p_arguments->>'p_branch_id','') is not null and not exists (
      select 1 from public.branches b
      where b.id = p_arguments->>'p_branch_id'
        and b.tenant_id::text = v_tenant_id
        and b.business_id = v_business_id
        and upper(b.status) = 'ACTIVE'
    ) then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;
  end if;

  -- Branch-scoped memberships cannot operate on another branch's ERP records.
  if v_member_branch_id is not null then
    if p_operation = 'create_purchase_order'
       and nullif(p_arguments->>'p_branch_id','') is distinct from v_member_branch_id then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    elsif p_operation = 'update_purchase_order_status'
       and v_record_branch_id is distinct from v_member_branch_id then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    elsif p_operation = 'receive_purchase_stock'
       and v_purchase_order_branch_id is distinct from v_member_branch_id then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    elsif p_operation = 'receive_purchase_stock'
       and not exists (
         select 1 from public.warehouses w
         where w.id = p_arguments->>'p_warehouse_id'
           and w.tenant_id::text = v_tenant_id and w.business_id = v_business_id
           and w.branch_id::text = v_member_branch_id and w.status = 'ACTIVE'
       ) then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    elsif p_operation = 'create_stock_transfer'
       and not exists (
         select 1 from public.warehouses source_w
         join public.warehouses target_w
           on target_w.id = p_arguments->>'p_to_warehouse_id'
          and target_w.tenant_id::text = v_tenant_id and target_w.business_id = v_business_id
         where source_w.id = p_arguments->>'p_from_warehouse_id'
           and source_w.tenant_id::text = v_tenant_id and source_w.business_id = v_business_id
           and source_w.branch_id::text = v_member_branch_id
           and target_w.branch_id::text = v_member_branch_id
           and source_w.status = 'ACTIVE' and target_w.status = 'ACTIVE'
       ) then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    elsif p_operation in ('receive_purchase_stock','create_stock_transfer')
       and not exists (
         select 1 from public.catalog_items ci
         where ci.id = (p_arguments->>'p_product_id')::uuid
           and ci.tenant_id::text = v_tenant_id and ci.business_id = v_business_id
           and ci.status = 'ACTIVE'
           and (ci.branch_id is null or ci.branch_id::text = v_member_branch_id)
       ) then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    elsif p_operation in ('update_stock_transfer_status','receive_stock_transfer')
       and not exists (
         select 1 from public.warehouses source_w
         join public.warehouses target_w on target_w.id = v_to_warehouse_id
           and target_w.tenant_id::text = v_tenant_id and target_w.business_id = v_business_id
         where source_w.id = v_from_warehouse_id
           and source_w.tenant_id::text = v_tenant_id and source_w.business_id = v_business_id
           and source_w.branch_id::text = v_member_branch_id
           and target_w.branch_id::text = v_member_branch_id
           and source_w.status = 'ACTIVE' and target_w.status = 'ACTIVE'
       ) then
      raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
    end if;
  end if;

  -- auth.uid() in the existing RPCs reads this transaction-local claim.
  -- Only service_role may execute this wrapper; the authenticated API supplies a verified user ID.
  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',p_actor_user_id::text,'role','authenticated')::text, true);

  case p_operation
    when 'create_purchase_order' then
      select public.create_purchase_order_backend(
        p_arguments->>'p_id',
        v_tenant_id,
        v_business_id,
        nullif(p_arguments->>'p_branch_id',''),
        p_arguments->>'p_order_number',
        p_arguments->>'p_supplier_id',
        (p_arguments->>'p_total_amount')::numeric,
        coalesce(nullif(p_arguments->>'p_tax_amount','')::numeric,0),
        coalesce(nullif(p_arguments->>'p_discount_amount','')::numeric,0),
        p_arguments->>'p_reason'
      ) into v_result;
    when 'update_purchase_order_status' then
      select public.update_purchase_order_status_backend(
        p_arguments->>'p_order_id', v_target_status
      ) into v_result;
    when 'receive_purchase_stock' then
      select public.receive_purchase_stock_backend(
        p_arguments->>'p_id', v_tenant_id, v_business_id,
        p_arguments->>'p_purchase_order_id', p_arguments->>'p_receipt_number',
        p_arguments->>'p_warehouse_id', (p_arguments->>'p_product_id')::uuid,
        (p_arguments->>'p_received_quantity')::numeric, (p_arguments->>'p_unit_cost')::numeric
      ) into v_result;
    when 'create_stock_transfer' then
      select public.create_stock_transfer_backend(
        p_arguments->>'p_id', v_tenant_id, v_business_id,
        p_arguments->>'p_transfer_number', p_arguments->>'p_from_warehouse_id',
        p_arguments->>'p_to_warehouse_id', (p_arguments->>'p_product_id')::uuid,
        (p_arguments->>'p_quantity')::numeric
      ) into v_result;
    when 'update_stock_transfer_status' then
      select public.update_stock_transfer_status_backend(
        p_arguments->>'p_transfer_id', v_target_status
      ) into v_result;
    when 'receive_stock_transfer' then
      select public.receive_stock_transfer_backend(p_arguments->>'p_transfer_id') into v_result;
  end case;

  return coalesce(v_result, jsonb_build_object('success', true));
end;
$function$;

revoke all on function public.erp_runtime_execute(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.erp_runtime_execute(uuid,text,jsonb) to service_role;
