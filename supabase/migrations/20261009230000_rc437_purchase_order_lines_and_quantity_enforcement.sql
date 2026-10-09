-- RC437: model approved purchase-order lines and enforce ordered/received quantities.
create table if not exists public.erp_purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null,
  business_id uuid not null,
  purchase_order_id varchar not null references public.erp_purchase_orders(id) on delete restrict,
  product_id uuid not null references public.catalog_items(id) on delete restrict,
  ordered_quantity numeric(14,3) not null check (ordered_quantity > 0 and ordered_quantity::text not in ('NaN','Infinity','-Infinity')),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0 and received_quantity <= ordered_quantity),
  unit_cost numeric(14,2) not null check (unit_cost >= 0 and unit_cost::text not in ('NaN','Infinity','-Infinity')),
  line_total numeric(16,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, product_id),
  unique (tenant_id, id)
);

create index if not exists erp_purchase_order_lines_scope_idx
  on public.erp_purchase_order_lines(tenant_id,business_id,purchase_order_id);

alter table public.erp_purchase_order_lines enable row level security;
drop policy if exists erp_purchase_order_lines_read_member on public.erp_purchase_order_lines;
create policy erp_purchase_order_lines_read_member on public.erp_purchase_order_lines
for select to authenticated
using (exists (
  select 1 from public.user_memberships m
  where m.user_id=auth.uid() and m.tenant_id=erp_purchase_order_lines.tenant_id
    and m.business_id=erp_purchase_order_lines.business_id and m.status='ACTIVE'
));
revoke all on public.erp_purchase_order_lines from anon,authenticated;
grant select on public.erp_purchase_order_lines to authenticated;
grant all on public.erp_purchase_order_lines to service_role;

create or replace function public.create_purchase_order_with_lines_backend(
  p_id varchar,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_order_number varchar,
  p_supplier_id varchar,p_tax_amount numeric,p_discount_amount numeric,p_reason text,p_lines jsonb
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  u uuid:=auth.uid(); v_role text; v_line jsonb; v_product uuid; v_qty numeric; v_cost numeric;
  v_subtotal numeric:=0; v_total numeric; v_tax numeric:=coalesce(p_tax_amount,0);
  v_discount numeric:=coalesce(p_discount_amount,0); v_existing public.erp_purchase_orders%rowtype;
  v_created public.erp_purchase_orders%rowtype; v_line_count integer:=0;
begin
  if u is null then raise exception 'UNAUTHENTICATED'; end if;
  if coalesce(length(pg_catalog.btrim(p_id)),0)<8 or coalesce(length(pg_catalog.btrim(p_order_number)),0)<1
     or coalesce(length(pg_catalog.btrim(p_supplier_id)),0)<1 or p_business_id is null
     or coalesce(length(pg_catalog.btrim(p_tenant_id)),0)<1 then raise exception 'INVALID_PURCHASE_ORDER'; end if;
  if v_tax<0 or v_discount<0 or v_tax::text in ('NaN','Infinity','-Infinity') or v_discount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_PURCHASE_ORDER_TOTALS';
  end if;
  if pg_catalog.jsonb_typeof(p_lines)<>'array' or pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>100 then
    raise exception 'PURCHASE_ORDER_LINES_REQUIRED';
  end if;
  select upper(m.role) into v_role from public.user_memberships m
  where m.user_id=u and m.tenant_id=p_tenant_id and m.business_id=p_business_id and m.status='ACTIVE' limit 1;
  if v_role is null or v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') then raise exception 'PURCHASE_ORDER_ROLE_REQUIRED'; end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE') then raise exception 'BUSINESS_INVALID'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.business_id=p_business_id) then raise exception 'BRANCH_INVALID'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id,437));
  select * into v_existing from public.erp_purchase_orders po where po.id=p_id for update;
  if found then
    if v_existing.tenant_id<>p_tenant_id or v_existing.business_id<>p_business_id or v_existing.order_number<>p_order_number or v_existing.supplier_id<>p_supplier_id then
      raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
    end if;
    if exists(select 1 from public.erp_purchase_order_lines pol where pol.purchase_order_id=p_id) then
      return pg_catalog.jsonb_build_object('success',true,'idempotent',true,'order',pg_catalog.to_jsonb(v_existing));
    end if;
    raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
  end if;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    if pg_catalog.jsonb_typeof(v_line)<>'object' then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    v_product:=nullif(v_line->>'product_id','')::uuid; v_qty:=nullif(v_line->>'quantity','')::numeric; v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    if v_product is null or v_qty is null or v_qty<=0 or v_cost is null or v_cost<0
       or v_qty::text in ('NaN','Infinity','-Infinity') or v_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then raise exception 'PRODUCT_INVALID'; end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(p_lines) as all_lines(value) where all_lines.value->>'product_id'=v_product::text and all_lines.value<>v_line) then
      raise exception 'DUPLICATE_PURCHASE_ORDER_PRODUCT';
    end if;
    v_subtotal:=v_subtotal+round(v_qty*v_cost,2); v_line_count:=v_line_count+1;
  end loop;
  if v_subtotal<=0 or v_discount>v_subtotal+v_tax then raise exception 'INVALID_PURCHASE_ORDER_TOTALS'; end if;
  v_total:=round(v_subtotal+v_tax-v_discount,2);
  insert into public.erp_purchase_orders(id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by)
  values(p_id,p_tenant_id,p_business_id,p_branch_id,p_order_number,p_supplier_id,v_total,v_tax,v_discount,'DRAFT',p_reason,u)
  returning * into v_created;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    v_product:=nullif(v_line->>'product_id','')::uuid; v_qty:=nullif(v_line->>'quantity','')::numeric; v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    insert into public.erp_purchase_order_lines(tenant_id,business_id,purchase_order_id,product_id,ordered_quantity,unit_cost,line_total)
    values(p_tenant_id,p_business_id,p_id,v_product,v_qty,v_cost,round(v_qty*v_cost,2));
  end loop;
  return pg_catalog.jsonb_build_object('success',true,'idempotent',false,'order',pg_catalog.to_jsonb(v_created),'line_count',v_line_count);
end;
$function$;
revoke all on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb) to authenticated;

create or replace function public.update_purchase_order_status_backend(p_order_id varchar,p_target_status varchar)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare u uuid:=auth.uid(); v_role text; v_order public.erp_purchase_orders%rowtype; v_next text;
begin
  if u is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_order from public.erp_purchase_orders po where po.id=p_order_id for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;
  select upper(m.role) into v_role from public.user_memberships m
  where m.user_id=u and m.tenant_id=v_order.tenant_id and m.business_id=v_order.business_id and m.status='ACTIVE' limit 1;
  if v_role is null then raise exception 'PURCHASE_ORDER_ROLE_REQUIRED'; end if;
  if p_target_status='SUBMITTED' and v_order.status='DRAFT' then
    if not exists(select 1 from public.erp_purchase_order_lines pol where pol.purchase_order_id=v_order.id and pol.tenant_id=v_order.tenant_id and pol.business_id=v_order.business_id) then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
    v_next:=case when v_order.total_amount>5000 then 'PENDING_APPROVAL' else 'SUBMITTED' end;
  elsif p_target_status='APPROVED' and v_order.status='PENDING_APPROVAL' and v_role in ('OWNER','BUSINESS_OWNER','ADMIN') then
    if not exists(select 1 from public.erp_purchase_order_lines pol where pol.purchase_order_id=v_order.id and pol.tenant_id=v_order.tenant_id and pol.business_id=v_order.business_id) then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
    v_next:='APPROVED';
  else raise exception 'INVALID_STATUS_TRANSITION'; end if;
  update public.erp_purchase_orders set status=v_next,updated_at=pg_catalog.now() where id=v_order.id returning * into v_order;
  return pg_catalog.jsonb_build_object('success',true,'order',pg_catalog.to_jsonb(v_order));
end;
$function$;
revoke all on function public.update_purchase_order_status_backend(varchar,varchar) from public,anon,authenticated;
grant execute on function public.update_purchase_order_status_backend(varchar,varchar) to authenticated;

create or replace function public.receive_purchase_stock_atomic_backend(
  p_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_purchase_order_id varchar,
  p_receipt_number varchar,
  p_warehouse_id varchar,
  p_product_id uuid,
  p_received_quantity numeric,
  p_unit_cost numeric,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.erp_purchase_orders%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_existing public.erp_purchase_receipts%rowtype;
  v_receipt public.erp_purchase_receipts%rowtype;
  v_balance public.stock_balances%rowtype;
  v_transaction public.inventory_transactions%rowtype;
  v_line public.erp_purchase_order_lines%rowtype;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_business_id is null or p_product_id is null or p_received_quantity is null
     or p_received_quantity <= 0
     or p_received_quantity::text in ('NaN','Infinity','-Infinity')
     or p_unit_cost is null or p_unit_cost < 0
     or p_unit_cost::text in ('NaN','Infinity','-Infinity')
     or coalesce(length(pg_catalog.btrim(p_id)),0)<8
     or coalesce(length(pg_catalog.btrim(p_receipt_number)),0)<1
     or coalesce(length(pg_catalog.btrim(p_purchase_order_id)),0)<1
     or coalesce(length(pg_catalog.btrim(p_tenant_id)),0)<1
     or coalesce(length(pg_catalog.btrim(p_warehouse_id)),0)<1 then
    raise exception 'INVALID_RECEIPT_INPUT';
  end if;

  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id
      and m.tenant_id=p_tenant_id
      and m.business_id=p_business_id
      and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) then
    raise exception 'PURCHASE_RECEIVING_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from public.businesses b
    where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE'
  ) then
    raise exception 'BUSINESS_SCOPE_INVALID';
  end if;

  select * into v_order
  from public.erp_purchase_orders po
  where po.id=p_purchase_order_id
    and po.tenant_id=p_tenant_id
    and po.business_id=p_business_id
  for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;
  if upper(v_order.status) <> 'APPROVED' then raise exception 'PURCHASE_ORDER_NOT_APPROVED'; end if;

  select * into v_warehouse
  from public.warehouses w
  where w.id=p_warehouse_id
    and w.tenant_id=p_tenant_id
    and w.business_id=p_business_id
    and w.status='ACTIVE'
  for share;
  if not found then raise exception 'WAREHOUSE_INVALID'; end if;

  if not exists (
    select 1 from public.catalog_items ci
    where ci.id=p_product_id
      and ci.tenant_id=p_tenant_id
      and ci.business_id=p_business_id
      and ci.status='ACTIVE'
  ) then
    raise exception 'PRODUCT_INVALID';
  end if;

  select * into v_existing
  from public.erp_purchase_receipts r
  where r.business_id=p_business_id and r.receipt_number=p_receipt_number
  for update;
  if found then
    if v_existing.tenant_id=p_tenant_id
       and v_existing.purchase_order_id=p_purchase_order_id
       and v_existing.warehouse_id=p_warehouse_id
       and v_existing.product_id=p_product_id
       and v_existing.received_quantity=p_received_quantity
       and v_existing.unit_cost=p_unit_cost then
      return pg_catalog.jsonb_build_object('success',true,'idempotent',true,'receipt',pg_catalog.to_jsonb(v_existing));
    end if;
    raise exception 'RECEIPT_IDEMPOTENCY_CONFLICT';
  end if;

  select * into v_line
  from public.erp_purchase_order_lines pol
  where pol.purchase_order_id=p_purchase_order_id
    and pol.tenant_id=p_tenant_id
    and pol.business_id=p_business_id
    and pol.product_id=p_product_id
  for update;
  if not found then raise exception 'PRODUCT_NOT_IN_PURCHASE_ORDER'; end if;
  if v_line.received_quantity + p_received_quantity > v_line.ordered_quantity then
    raise exception 'PURCHASE_ORDER_QUANTITY_EXCEEDED';
  end if;

  insert into public.erp_purchase_receipts(
    id,tenant_id,business_id,purchase_order_id,receipt_number,warehouse_id,product_id,
    received_quantity,unit_cost,status,created_by
  )
  values(
    p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,
    p_received_quantity,p_unit_cost,'RECEIVED',p_actor_user_id
  )
  on conflict do nothing
  returning * into v_receipt;

  if not found then
    select * into v_existing
    from public.erp_purchase_receipts r
    where r.business_id=p_business_id and r.receipt_number=p_receipt_number;
    if found
       and v_existing.tenant_id=p_tenant_id
       and v_existing.purchase_order_id=p_purchase_order_id
       and v_existing.warehouse_id=p_warehouse_id
       and v_existing.product_id=p_product_id
       and v_existing.received_quantity=p_received_quantity
       and v_existing.unit_cost=p_unit_cost then
      return pg_catalog.jsonb_build_object('success',true,'idempotent',true,'receipt',pg_catalog.to_jsonb(v_existing));
    end if;
    raise exception 'RECEIPT_IDEMPOTENCY_CONFLICT';
  end if;

  update public.erp_purchase_order_lines
  set received_quantity=received_quantity+p_received_quantity,updated_at=pg_catalog.now()
  where id=v_line.id;

  insert into public.stock_balances as sb(
    id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved
  )
  values(
    'sb-'||pg_catalog.gen_random_uuid()::text,p_tenant_id,p_business_id,v_warehouse.branch_id,
    p_warehouse_id,p_product_id,p_received_quantity,0
  )
  on conflict (warehouse_id,product_id) do update
    set quantity_on_hand=sb.quantity_on_hand+excluded.quantity_on_hand,
        updated_at=pg_catalog.now()
    where sb.tenant_id=excluded.tenant_id and sb.business_id=excluded.business_id
  returning * into v_balance;
  if not found then raise exception 'STOCK_BALANCE_SCOPE_CONFLICT'; end if;

  insert into public.inventory_transactions(
    id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,
    unit_cost,reference_id,created_by
  )
  values(
    'it-'||pg_catalog.gen_random_uuid()::text,p_tenant_id,p_business_id,v_warehouse.branch_id,
    p_warehouse_id,p_product_id,'PURCHASE_RECEIPT',p_received_quantity,p_unit_cost,v_receipt.id,p_actor_user_id
  )
  returning * into v_transaction;

  return pg_catalog.jsonb_build_object(
    'success',true,'idempotent',false,'receipt',pg_catalog.to_jsonb(v_receipt),
    'balance',pg_catalog.to_jsonb(v_balance),'transaction',pg_catalog.to_jsonb(v_transaction)
  );
end;
$function$;


