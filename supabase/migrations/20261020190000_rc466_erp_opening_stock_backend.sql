-- RC466: actor-aware, branch-scoped opening-stock workflow.
-- The existing stock ledger RPC remains internal; this wrapper is the only approved server gateway.
create or replace function public.erp_opening_stock_backend(
  p_actor_user_id uuid,
  p_arguments jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_tenant_id text;
  v_business_id uuid;
  v_warehouse_id text;
  v_product_id uuid;
  v_role text;
  v_member_branch_id text;
  v_warehouse_branch_id text;
  v_result jsonb;
  v_quantity numeric;
  v_unit_cost numeric;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_arguments is null or jsonb_typeof(p_arguments) <> 'object' then raise exception 'INVALID_ARGUMENTS'; end if;

  v_tenant_id := nullif(btrim(p_arguments->>'p_tenant_id'),'');
  v_business_id := nullif(p_arguments->>'p_business_id','')::uuid;
  v_warehouse_id := nullif(btrim(p_arguments->>'p_warehouse_id'),'');
  v_product_id := nullif(p_arguments->>'p_product_id','')::uuid;
  v_quantity := nullif(p_arguments->>'p_quantity','')::numeric;
  v_unit_cost := coalesce(nullif(p_arguments->>'p_unit_cost','')::numeric,0);

  if v_tenant_id is null or v_business_id is null or v_warehouse_id is null or v_product_id is null then
    raise exception 'ERP_SCOPE_REQUIRED';
  end if;
  if v_quantity is null or v_quantity <= 0 or v_unit_cost < 0 then raise exception 'INVALID_OPENING_STOCK'; end if;
  if coalesce(length(btrim(p_arguments->>'p_id')),0) < 8
     or coalesce(length(btrim(p_arguments->>'p_reference_id')),0) < 1 then
    raise exception 'INVALID_OPENING_STOCK_REFERENCE';
  end if;

  select upper(m.role), m.branch_id::text into v_role, v_member_branch_id
  from public.user_memberships m
  where m.user_id = p_actor_user_id
    and m.tenant_id::text = v_tenant_id
    and m.business_id = v_business_id
    and m.status = 'ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  order by case upper(m.role) when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3 when 'MANAGER' then 4 else 5 end,
           case when m.branch_id is null then 0 else 1 end
  limit 1;
  if v_role is null then raise exception 'OPENING_STOCK_ROLE_REQUIRED'; end if;

  select w.branch_id::text into v_warehouse_branch_id
  from public.warehouses w
  where w.id = v_warehouse_id and w.tenant_id::text = v_tenant_id
    and w.business_id = v_business_id and w.status = 'ACTIVE';
  if not found then raise exception 'WAREHOUSE_INVALID'; end if;
  if v_member_branch_id is not null and v_member_branch_id is distinct from v_warehouse_branch_id then
    raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
  end if;

  if not exists (
    select 1 from public.catalog_items c
    where c.id = v_product_id and c.tenant_id::text = v_tenant_id
      and c.business_id = v_business_id and c.status = 'ACTIVE'
      and (c.branch_id is null or c.branch_id::text = v_warehouse_branch_id)
  ) then raise exception 'PRODUCT_INVALID'; end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',p_actor_user_id::text,'role','authenticated')::text, true);

  select public.initialize_opening_stock_backend(
    p_arguments->>'p_id', v_tenant_id, v_business_id, v_warehouse_id,
    v_product_id, v_quantity, v_unit_cost, p_arguments->>'p_reference_id'
  ) into v_result;
  return coalesce(v_result,jsonb_build_object('success',true));
end;
$function$;

revoke all on function public.erp_opening_stock_backend(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.erp_opening_stock_backend(uuid,jsonb) to service_role;
