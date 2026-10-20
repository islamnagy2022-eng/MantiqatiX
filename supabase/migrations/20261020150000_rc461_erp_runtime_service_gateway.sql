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
  if p_operation not in (
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
    select tenant_id::text, business_id into v_tenant_id, v_business_id
      from public.erp_purchase_orders
      where id = p_arguments->>'p_order_id';
    v_row_exists := found;
  else
    select tenant_id::text, business_id into v_tenant_id, v_business_id
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

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id = p_actor_user_id
    and m.tenant_id::text = v_tenant_id
    and m.business_id = v_business_id
    and m.status = 'ACTIVE'
  order by case upper(m.role)
    when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3
    when 'MANAGER' then 4 when 'FINANCE_MANAGER' then 5 when 'ACCOUNTANT' then 6
    when 'FINANCE' then 7 when 'EMPLOYEE' then 8 when 'STAFF' then 9 else 99 end
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

  -- auth.uid() in the existing RPCs reads this transaction-local claim.
  -- Only service_role may execute this wrapper; the Edge Function supplies a verified user ID.
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
