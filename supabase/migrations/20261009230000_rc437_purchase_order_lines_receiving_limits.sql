-- RC437: model approved purchase-order lines and enforce cumulative receiving limits.
-- Existing approved orders without lines are intentionally blocked until reconciled/backfilled.

create table if not exists public.erp_purchase_order_lines (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  purchase_order_id varchar not null references public.erp_purchase_orders(id) on delete restrict,
  line_number integer not null,
  product_id uuid not null references public.catalog_items(id) on delete restrict,
  ordered_quantity numeric(18,4) not null check (ordered_quantity > 0 and ordered_quantity::text not in ('NaN','Infinity','-Infinity')),
  received_quantity numeric(18,4) not null default 0 check (received_quantity >= 0 and received_quantity <= ordered_quantity),
  unit_cost numeric(18,4) not null check (unit_cost >= 0 and unit_cost::text not in ('NaN','Infinity','-Infinity')),
  description text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (purchase_order_id,line_number),
  unique (purchase_order_id,product_id)
);

create index if not exists erp_purchase_order_lines_scope_idx
  on public.erp_purchase_order_lines(tenant_id,business_id,purchase_order_id);

alter table public.erp_purchase_order_lines enable row level security;
revoke all on public.erp_purchase_order_lines from anon,authenticated;
grant select,insert,update,delete on public.erp_purchase_order_lines to service_role;

create or replace function public.set_purchase_order_lines_backend(
  p_order_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_lines jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.erp_purchase_orders%rowtype;
  v_line jsonb;
  v_line_number integer := 0;
  v_product uuid;
  v_qty numeric;
  v_cost numeric;
  v_seen uuid[] := array[]::uuid[];
  v_total numeric := 0;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(pg_catalog.btrim(p_order_id),'') is null or nullif(pg_catalog.btrim(p_tenant_id),'') is null or p_business_id is null then
    raise exception 'INVALID_PURCHASE_ORDER_SCOPE';
  end if;
  if pg_catalog.jsonb_typeof(p_lines)<>'array' or pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>200 then
    raise exception 'PURCHASE_ORDER_LINES_REQUIRED';
  end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) then raise exception 'PURCHASE_ORDER_LINES_FORBIDDEN'; end if;
  if not exists (select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE') then
    raise exception 'BUSINESS_SCOPE_INVALID';
  end if;
  select * into v_order from public.erp_purchase_orders po
  where po.id=p_order_id and po.tenant_id=p_tenant_id and po.business_id=p_business_id for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;
  if upper(v_order.status)<>'DRAFT' then raise exception 'PURCHASE_ORDER_NOT_EDITABLE'; end if;

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as x(value) loop
    v_line_number:=v_line_number+1;
    if pg_catalog.jsonb_typeof(v_line)<>'object' then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    begin
      v_product:=nullif(v_line->>'product_id','')::uuid;
      v_qty:=nullif(v_line->>'ordered_quantity','')::numeric;
      v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    exception when others then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end;
    if v_product is null or v_qty is null or v_qty<=0 or v_qty::text in ('NaN','Infinity','-Infinity')
       or v_cost is null or v_cost<0 or v_cost::text in ('NaN','Infinity','-Infinity') then
      raise exception 'INVALID_PURCHASE_ORDER_LINE';
    end if;
    if v_product=any(v_seen) then raise exception 'DUPLICATE_PURCHASE_ORDER_PRODUCT'; end if;
    v_seen:=pg_catalog.array_append(v_seen,v_product);
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then
      raise exception 'PRODUCT_INVALID';
    end if;
    v_total:=v_total+(v_qty*v_cost);
  end loop;

  delete from public.erp_purchase_order_lines where purchase_order_id=p_order_id;
  v_line_number:=0;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as x(value) loop
    v_line_number:=v_line_number+1;
    insert into public.erp_purchase_order_lines(
      id,tenant_id,business_id,purchase_order_id,line_number,product_id,ordered_quantity,received_quantity,unit_cost,description
    ) values (
      coalesce(nullif(pg_catalog.btrim(v_line->>'id'),''),p_order_id||'-line-'||v_line_number::text),
      p_tenant_id,p_business_id,p_order_id,v_line_number,(v_line->>'product_id')::uuid,
      (v_line->>'ordered_quantity')::numeric,0,(v_line->>'unit_cost')::numeric,
      nullif(pg_catalog.btrim(v_line->>'description'),'')
    );
  end loop;
  return pg_catalog.jsonb_build_object('success',true,'order_id',p_order_id,'line_count',v_line_number,'line_subtotal',v_total);
end;
$function$;

revoke all on function public.set_purchase_order_lines_backend(varchar,varchar,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.set_purchase_order_lines_backend(varchar,varchar,uuid,jsonb,uuid) to service_role;

create or replace function public.receive_purchase_stock_with_order_line_backend(
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
  v_line public.erp_purchase_order_lines%rowtype;
  v_existing public.erp_purchase_receipts%rowtype;
  v_result jsonb;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;

  -- Exact receipt replay is delegated to RC434, without incrementing the order line twice.
  select * into v_existing from public.erp_purchase_receipts r
  where r.business_id=p_business_id and r.receipt_number=p_receipt_number for update;
  if found then
    return public.receive_purchase_stock_atomic_backend(
      p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,
      p_received_quantity,p_unit_cost,p_actor_user_id
    );
  end if;

  select * into v_line from public.erp_purchase_order_lines l
  where l.purchase_order_id=p_purchase_order_id and l.tenant_id=p_tenant_id and l.business_id=p_business_id
    and l.product_id=p_product_id
  for update;
  if not found then raise exception 'PRODUCT_NOT_IN_PURCHASE_ORDER'; end if;
  if v_line.received_quantity+p_received_quantity>v_line.ordered_quantity then raise exception 'PURCHASE_ORDER_QUANTITY_EXCEEDED'; end if;
  if p_unit_cost is distinct from v_line.unit_cost then raise exception 'PURCHASE_ORDER_UNIT_COST_MISMATCH'; end if;

  v_result:=public.receive_purchase_stock_atomic_backend(
    p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,
    p_received_quantity,p_unit_cost,p_actor_user_id
  );
  if coalesce((v_result->>'success')::boolean,false) is not true then raise exception 'PURCHASE_RECEIPT_FAILED'; end if;
  update public.erp_purchase_order_lines
  set received_quantity=received_quantity+p_received_quantity,updated_at=pg_catalog.now()
  where id=v_line.id and received_quantity+p_received_quantity<=ordered_quantity;
  if not found then raise exception 'PURCHASE_ORDER_QUANTITY_EXCEEDED'; end if;
  return v_result||pg_catalog.jsonb_build_object('order_line_id',v_line.id,'order_line_received_quantity',v_line.received_quantity+p_received_quantity);
end;
$function$;

revoke all on function public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) from public,anon,authenticated;
grant execute on function public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) to service_role;

-- Force all service calls through the line-aware wrapper. The SECURITY DEFINER wrapper can call RC434 internally as owner.
revoke all on function public.receive_purchase_stock_atomic_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) from public,anon,authenticated,service_role;

comment on table public.erp_purchase_order_lines is
  'RC437: approved purchase-order product quantities and cumulative received quantity; legacy orders without lines must be reconciled before receiving.';
