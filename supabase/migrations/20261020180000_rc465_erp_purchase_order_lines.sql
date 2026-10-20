-- RC465: purchase-order lines and line-aware receiving.
-- All writes remain behind service-role-only RPCs; the API supplies a verified actor ID.
create table if not exists public.erp_purchase_order_lines (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  purchase_order_id varchar not null references public.erp_purchase_orders(id) on delete cascade,
  product_id uuid not null references public.catalog_items(id),
  ordered_quantity numeric(18,4) not null check (ordered_quantity > 0),
  received_quantity numeric(18,4) not null default 0 check (received_quantity >= 0 and received_quantity <= ordered_quantity),
  unit_cost numeric(18,4) not null check (unit_cost >= 0),
  line_total numeric(18,4) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_purchase_order_lines_one_product unique (tenant_id,business_id,purchase_order_id,product_id)
);
create index if not exists erp_purchase_order_lines_scope_idx
  on public.erp_purchase_order_lines(tenant_id,business_id,purchase_order_id);
alter table public.erp_purchase_order_lines enable row level security;
revoke all on public.erp_purchase_order_lines from public, anon, authenticated;
grant select,insert,update,delete on public.erp_purchase_order_lines to service_role;

create table if not exists public.erp_purchase_receipt_idempotency (
  tenant_id text not null,
  business_id uuid not null,
  receipt_id text not null,
  receipt_number text not null,
  purchase_order_id text not null,
  warehouse_id text not null,
  product_id uuid not null,
  received_quantity numeric not null check (received_quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id,business_id,receipt_id),
  unique (tenant_id,business_id,receipt_number)
);
revoke all on table public.erp_purchase_receipt_idempotency from public,anon,authenticated;
grant select,insert,update,delete on table public.erp_purchase_receipt_idempotency to service_role;

create or replace function public.erp_purchase_order_create_with_lines_backend(
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
  v_branch_id text;
  v_order_id text;
  v_order_number text;
  v_supplier_id text;
  v_reason text;
  v_role text;
  v_member_branch_id text;
  v_lines jsonb;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
  v_seen_products text[] := array[]::text[];
  v_existing public.erp_purchase_orders%rowtype;
  v_existing_line_count integer;
  v_line_count integer;
  v_result jsonb;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_arguments is null or jsonb_typeof(p_arguments) <> 'object' then raise exception 'INVALID_ARGUMENTS'; end if;
  v_tenant_id := nullif(btrim(p_arguments->>'p_tenant_id'),'');
  v_business_id := nullif(p_arguments->>'p_business_id','')::uuid;
  v_branch_id := nullif(p_arguments->>'p_branch_id','');
  v_order_id := nullif(btrim(p_arguments->>'p_id'),'');
  v_order_number := nullif(btrim(p_arguments->>'p_order_number'),'');
  v_supplier_id := nullif(btrim(p_arguments->>'p_supplier_id'),'');
  v_reason := nullif(btrim(p_arguments->>'p_reason'),'');
  v_lines := p_arguments->'p_lines';
  v_tax := coalesce(nullif(p_arguments->>'p_tax_amount','')::numeric,0);
  v_discount := coalesce(nullif(p_arguments->>'p_discount_amount','')::numeric,0);

  if coalesce(v_tenant_id,'')='' or v_business_id is null then raise exception 'ERP_SCOPE_REQUIRED'; end if;
  if coalesce(length(v_order_id),0)<8 or coalesce(length(v_order_number),0)<1 or v_supplier_id is null then
    raise exception 'ERP_PURCHASE_ORDER_REQUIRED_FIELDS';
  end if;
  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) < 1 or jsonb_array_length(v_lines) > 100 then
    raise exception 'ERP_PURCHASE_ORDER_LINES_REQUIRED';
  end if;
  if v_tax < 0 or v_discount < 0 then raise exception 'ERP_PURCHASE_ORDER_AMOUNT_INVALID'; end if;

  select upper(m.role),m.branch_id::text into v_role,v_member_branch_id
  from public.user_memberships m
  where m.user_id=p_actor_user_id and m.tenant_id::text=v_tenant_id
    and m.business_id=v_business_id and m.status='ACTIVE'
    and (m.branch_id is null or m.branch_id::text is not distinct from v_branch_id)
  order by case upper(m.role)
    when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3
    when 'MANAGER' then 4 when 'EMPLOYEE' then 5 when 'STAFF' then 6 else 99 end,
    case when m.branch_id is null then 0 else 1 end
  limit 1;
  if v_role is null then raise exception 'ERP_MEMBERSHIP_REQUIRED'; end if;
  if v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') then
    raise exception 'PURCHASE_ORDER_ROLE_REQUIRED';
  end if;
  if not exists(select 1 from public.businesses b where b.id=v_business_id and b.tenant_id::text=v_tenant_id and upper(b.status)='ACTIVE') then
    raise exception 'BUSINESS_INVALID';
  end if;
  if v_branch_id is not null and not exists(
    select 1 from public.branches b where b.id::text=v_branch_id and b.tenant_id::text=v_tenant_id
      and b.business_id=v_business_id and upper(b.status)='ACTIVE'
  ) then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;
  if not exists(select 1 from public.erp_suppliers s where s.id=v_supplier_id and s.tenant_id::text=v_tenant_id
      and s.business_id=v_business_id and s.status='ACTIVE'
      and (s.branch_id is null or s.branch_id::text is not distinct from v_branch_id)) then
    raise exception 'ERP_SUPPLIER_SCOPE_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_tenant_id||':'||v_business_id::text||':'||v_order_id,0));
  select * into v_existing from public.erp_purchase_orders o where o.id=v_order_id for update;
  if found then
    if v_existing.tenant_id::text<>v_tenant_id or v_existing.business_id<>v_business_id
       or v_existing.branch_id::text is distinct from v_branch_id
       or v_existing.order_number<>v_order_number or v_existing.supplier_id<>v_supplier_id then
      raise exception 'ERP_PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
    end if;
    select count(*) into v_existing_line_count from public.erp_purchase_order_lines l
      where l.tenant_id=v_tenant_id and l.business_id=v_business_id and l.purchase_order_id=v_order_id;
    if v_existing_line_count<>jsonb_array_length(v_lines) then raise exception 'ERP_PURCHASE_ORDER_IDEMPOTENCY_CONFLICT'; end if;
    for v_item in select value from jsonb_array_elements(v_lines) loop
      v_product_id := nullif(v_item->>'product_id','')::uuid;
      v_quantity := nullif(v_item->>'quantity','')::numeric;
      v_unit_cost := nullif(v_item->>'unit_cost','')::numeric;
      if v_product_id is null or v_quantity is null or v_quantity<=0 or v_unit_cost is null or v_unit_cost<0 then
        raise exception 'ERP_PURCHASE_ORDER_LINE_INVALID';
      end if;
      if not exists(select 1 from public.erp_purchase_order_lines l where l.tenant_id=v_tenant_id
          and l.business_id=v_business_id and l.purchase_order_id=v_order_id and l.product_id=v_product_id
          and l.ordered_quantity=v_quantity and l.unit_cost=v_unit_cost) then
        raise exception 'ERP_PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
      end if;
    end loop;
    return jsonb_build_object('success',true,'idempotent',true,'order',to_jsonb(v_existing),
      'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]'::jsonb)
        from public.erp_purchase_order_lines l where l.purchase_order_id=v_order_id));
  end if;

  for v_item in select value from jsonb_array_elements(v_lines) loop
    v_product_id := nullif(v_item->>'product_id','')::uuid;
    v_quantity := nullif(v_item->>'quantity','')::numeric;
    v_unit_cost := nullif(v_item->>'unit_cost','')::numeric;
    if v_product_id is null or v_quantity is null or v_quantity<=0 or v_unit_cost is null or v_unit_cost<0 then
      raise exception 'ERP_PURCHASE_ORDER_LINE_INVALID';
    end if;
    if v_product_id::text=any(v_seen_products) then raise exception 'ERP_PURCHASE_ORDER_DUPLICATE_PRODUCT'; end if;
    v_seen_products := array_append(v_seen_products,v_product_id::text);
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product_id and ci.tenant_id::text=v_tenant_id
        and ci.business_id=v_business_id and ci.status='ACTIVE'
        and (ci.branch_id is null or ci.branch_id::text is not distinct from v_branch_id)) then
      raise exception 'ERP_PRODUCT_SCOPE_INVALID';
    end if;
    v_subtotal := v_subtotal + (v_quantity*v_unit_cost);
  end loop;
  if v_discount > v_subtotal+v_tax then raise exception 'ERP_PURCHASE_ORDER_AMOUNT_INVALID'; end if;
  v_total := v_subtotal+v_tax-v_discount;

  perform set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_user_id::text,'role','authenticated')::text,true);
  select public.create_purchase_order_backend(v_order_id,v_tenant_id,v_business_id,v_branch_id,
    v_order_number,v_supplier_id,v_total,v_tax,v_discount,v_reason) into v_result;
  if coalesce((v_result->>'success')::boolean,false) is not true then raise exception 'ERP_PURCHASE_ORDER_CREATE_FAILED'; end if;

  for v_item in select value from jsonb_array_elements(v_lines) loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    insert into public.erp_purchase_order_lines(id,tenant_id,business_id,purchase_order_id,product_id,
      ordered_quantity,received_quantity,unit_cost,line_total)
    values('pol-'||gen_random_uuid()::text,v_tenant_id,v_business_id,v_order_id,v_product_id,
      v_quantity,0,v_unit_cost,round(v_quantity*v_unit_cost,4));
  end loop;
  select to_jsonb(o) into v_result from public.erp_purchase_orders o where o.id=v_order_id;
  return jsonb_build_object('success',true,'idempotent',false,'order',v_result,
    'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]'::jsonb)
      from public.erp_purchase_order_lines l where l.purchase_order_id=v_order_id));
end;
$function$;

create or replace function public.erp_purchase_stock_receive_with_lines_backend(
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
  v_order_id text;
  v_requested_branch_id text;
  v_receipt_id text;
  v_receipt_number text;
  v_warehouse_id text;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_role text;
  v_member_branch_id text;
  v_order_branch_id text;
  v_order_status text;
  v_warehouse_branch_id text;
  v_line public.erp_purchase_order_lines%rowtype;
  v_existing public.erp_purchase_receipts%rowtype;
  v_idempotency public.erp_purchase_receipt_idempotency%rowtype;
  v_result jsonb;
  v_order_status_after text;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_arguments is null or jsonb_typeof(p_arguments)<>'object' then raise exception 'INVALID_ARGUMENTS'; end if;
  v_tenant_id:=nullif(p_arguments->>'p_tenant_id','');
  v_business_id:=nullif(p_arguments->>'p_business_id','')::uuid;
  v_order_id:=nullif(p_arguments->>'p_purchase_order_id','');
  v_requested_branch_id:=nullif(p_arguments->>'p_branch_id','');
  v_receipt_id:=nullif(p_arguments->>'p_id','');
  v_receipt_number:=nullif(btrim(p_arguments->>'p_receipt_number'),'');
  v_warehouse_id:=nullif(p_arguments->>'p_warehouse_id','');
  v_product_id:=nullif(p_arguments->>'p_product_id','')::uuid;
  v_quantity:=nullif(p_arguments->>'p_received_quantity','')::numeric;
  v_unit_cost:=nullif(p_arguments->>'p_unit_cost','')::numeric;
  if coalesce(v_tenant_id,'')='' or v_business_id is null or v_order_id is null then raise exception 'ERP_SCOPE_REQUIRED'; end if;
  if coalesce(length(v_receipt_id),0)<8 or v_receipt_number is null or v_warehouse_id is null
     or v_product_id is null or v_quantity is null or v_quantity<=0 or v_unit_cost is null or v_unit_cost<0 then
    raise exception 'ERP_PURCHASE_ORDER_LINE_INVALID';
  end if;

  select upper(m.role),m.branch_id::text into v_role,v_member_branch_id
  from public.user_memberships m where m.user_id=p_actor_user_id and m.tenant_id::text=v_tenant_id
    and m.business_id=v_business_id and m.status='ACTIVE'
    and (m.branch_id is null or m.branch_id::text is not distinct from v_requested_branch_id)
    and (v_requested_branch_id is not null or m.branch_id is null)
  order by case upper(m.role) when 'OWNER' then 1 when 'BUSINESS_OWNER' then 2 when 'ADMIN' then 3
    when 'MANAGER' then 4 when 'EMPLOYEE' then 5 when 'STAFF' then 6 when 'ACCOUNTANT' then 7
    when 'FINANCE_MANAGER' then 8 when 'FINANCE' then 9 else 99 end,
    case when m.branch_id is null then 0 else 1 end limit 1;
  if v_role is null then raise exception 'ERP_MEMBERSHIP_REQUIRED'; end if;
  if v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
    raise exception 'PURCHASE_RECEIVING_ROLE_REQUIRED';
  end if;

  -- Lock and authorize the order before looking up an idempotent receipt, preventing cross-branch receipt probing.
  select o.branch_id::text,upper(o.status) into v_order_branch_id,v_order_status
  from public.erp_purchase_orders o where o.id=v_order_id and o.tenant_id::text=v_tenant_id
    and o.business_id=v_business_id for update;
  if not found then raise exception 'ERP_PURCHASE_ORDER_SCOPE_INVALID'; end if;
  if v_member_branch_id is not null and v_member_branch_id is distinct from v_order_branch_id then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;
  if v_requested_branch_id is not null and v_requested_branch_id is distinct from v_order_branch_id then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;
  if v_member_branch_id is null and v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER') and v_order_branch_id is not null then
    raise exception 'ERP_BRANCH_SCOPE_REQUIRED';
  end if;

  -- First consult a transactionally maintained idempotency ledger. The legacy stock RPC
  -- remains responsible for inventory/financial mutations; this ledger makes retries stable
  -- even when legacy receipt rows normalize identifiers differently.
  select * into v_idempotency from public.erp_purchase_receipt_idempotency r
  where r.tenant_id=v_tenant_id and r.business_id=v_business_id
    and (r.receipt_number=v_receipt_number or r.receipt_id=v_receipt_id)
  order by case when r.receipt_id=v_receipt_id then 0 else 1 end
  limit 1;
  if found then
    if v_idempotency.receipt_id<>v_receipt_id or v_idempotency.receipt_number<>v_receipt_number
       or v_idempotency.purchase_order_id<>v_order_id or v_idempotency.warehouse_id<>v_warehouse_id
       or v_idempotency.product_id<>v_product_id or v_idempotency.received_quantity<>v_quantity
       or v_idempotency.unit_cost<>v_unit_cost then raise exception 'ERP_RECEIPT_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'receipt',to_jsonb(v_idempotency));
  end if;

  select * into v_existing from public.erp_purchase_receipts r
  where r.tenant_id::text=v_tenant_id and r.business_id=v_business_id
    and (r.receipt_number=v_receipt_number or r.id::text=v_receipt_id)
  order by case when r.id::text=v_receipt_id then 0 else 1 end
  limit 1;
  if found then
    if v_existing.id::text<>v_receipt_id or v_existing.receipt_number<>v_receipt_number
       or v_existing.purchase_order_id<>v_order_id or v_existing.warehouse_id<>v_warehouse_id
       or v_existing.product_id<>v_product_id or v_existing.received_quantity<>v_quantity
       or v_existing.unit_cost<>v_unit_cost then raise exception 'ERP_RECEIPT_IDEMPOTENCY_CONFLICT'; end if;
    insert into public.erp_purchase_receipt_idempotency
      (tenant_id,business_id,receipt_id,receipt_number,purchase_order_id,warehouse_id,product_id,received_quantity,unit_cost)
    values (v_tenant_id,v_business_id,v_receipt_id,v_receipt_number,v_order_id,v_warehouse_id,v_product_id,v_quantity,v_unit_cost);
    return jsonb_build_object('success',true,'idempotent',true,'receipt',to_jsonb(v_existing));
  end if;

  if coalesce(v_order_status,'') not in ('SUBMITTED','APPROVED','PARTIALLY_RECEIVED') then raise exception 'ERP_PURCHASE_ORDER_NOT_READY_FOR_RECEIPT'; end if;

  select w.branch_id::text into v_warehouse_branch_id from public.warehouses w
  where w.id=v_warehouse_id and w.tenant_id::text=v_tenant_id and w.business_id=v_business_id and w.status='ACTIVE';
  if not found then raise exception 'ERP_WAREHOUSE_INVALID'; end if;
  if v_member_branch_id is not null and v_warehouse_branch_id is distinct from v_member_branch_id then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;
  if v_order_branch_id is not null and v_warehouse_branch_id is distinct from v_order_branch_id then raise exception 'ERP_BRANCH_SCOPE_REQUIRED'; end if;
  if not exists(select 1 from public.catalog_items ci where ci.id=v_product_id and ci.tenant_id::text=v_tenant_id
      and ci.business_id=v_business_id and ci.status='ACTIVE'
      and (ci.branch_id is null or ci.branch_id::text is not distinct from v_order_branch_id)) then
    raise exception 'ERP_PRODUCT_SCOPE_INVALID';
  end if;

  select * into v_line from public.erp_purchase_order_lines l
  where l.tenant_id=v_tenant_id and l.business_id=v_business_id and l.purchase_order_id=v_order_id and l.product_id=v_product_id
  for update;
  if not found then raise exception 'ERP_PURCHASE_ORDER_LINE_NOT_FOUND'; end if;
  if v_line.received_quantity+v_quantity>v_line.ordered_quantity then raise exception 'ERP_PURCHASE_ORDER_RECEIVE_LIMIT_EXCEEDED'; end if;

  perform set_config('request.jwt.claim.sub',p_actor_user_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_user_id::text,'role','authenticated')::text,true);
  select public.receive_purchase_stock_backend(v_receipt_id,v_tenant_id,v_business_id,v_order_id,
    v_receipt_number,v_warehouse_id,v_product_id,v_quantity,v_unit_cost) into v_result;

  insert into public.erp_purchase_receipt_idempotency
    (tenant_id,business_id,receipt_id,receipt_number,purchase_order_id,warehouse_id,product_id,received_quantity,unit_cost)
  values (v_tenant_id,v_business_id,v_receipt_id,v_receipt_number,v_order_id,v_warehouse_id,v_product_id,v_quantity,v_unit_cost);

  -- A legacy RPC may report an idempotent replay even if its receipt row uses a normalized
  -- identifier. Preserve the existing order-line quantity in that case.
  if coalesce((v_result->>'idempotent')::boolean,false) then
    return coalesce(v_result,'{}'::jsonb)||jsonb_build_object(
      'idempotent',true,'order_status',v_order_status,'purchase_order_line',to_jsonb(v_line));
  end if;

  update public.erp_purchase_order_lines l set received_quantity=l.received_quantity+v_quantity,updated_at=now()
  where l.id=v_line.id returning * into v_line;
  if not exists(select 1 from public.erp_purchase_order_lines l where l.tenant_id=v_tenant_id
      and l.business_id=v_business_id and l.purchase_order_id=v_order_id and l.received_quantity<l.ordered_quantity) then
    v_order_status_after:='RECEIVED';
  else
    v_order_status_after:='PARTIALLY_RECEIVED';
  end if;
  update public.erp_purchase_orders set status=v_order_status_after,updated_at=now()
    where id=v_order_id and tenant_id::text=v_tenant_id and business_id=v_business_id;
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('idempotent',false,'order_status',v_order_status_after,'purchase_order_line',to_jsonb(v_line));
end;
$function$;

revoke all on function public.erp_purchase_order_create_with_lines_backend(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.erp_purchase_order_create_with_lines_backend(uuid,jsonb) to service_role;
revoke all on function public.erp_purchase_stock_receive_with_lines_backend(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.erp_purchase_stock_receive_with_lines_backend(uuid,jsonb) to service_role;
