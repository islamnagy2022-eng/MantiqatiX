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
  if coalesce(pg_catalog.jsonb_typeof(p_lines),'null')<>'array' then
    raise exception 'PURCHASE_ORDER_LINES_REQUIRED';
  end if;
  if pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>200 then
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

create or replace function public.create_purchase_order_with_lines_backend(
  p_id varchar,
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar,
  p_order_number varchar,
  p_supplier_id varchar,
  p_tax_amount numeric,
  p_discount_amount numeric,
  p_reason text,
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
  v_line public.erp_purchase_order_lines%rowtype;
  v_input jsonb;
  v_product uuid;
  v_qty numeric;
  v_cost numeric;
  v_line_no integer := 0;
  v_subtotal numeric := 0;
  v_existing_count integer;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(pg_catalog.btrim(p_id),'') is null or length(p_id)>128
     or nullif(pg_catalog.btrim(p_tenant_id),'') is null
     or p_business_id is null
     or nullif(pg_catalog.btrim(p_order_number),'') is null
     or length(p_order_number)>128
     or nullif(pg_catalog.btrim(p_supplier_id),'') is null
     or p_tax_amount is null or p_tax_amount<0 or p_tax_amount::text in ('NaN','Infinity','-Infinity')
     or p_discount_amount is null or p_discount_amount<0 or p_discount_amount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_PURCHASE_ORDER_INPUT';
  end if;
  if coalesce(pg_catalog.jsonb_typeof(p_lines),'null')<>'array' then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
  if pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>200 then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE'
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) then raise exception 'PURCHASE_ORDER_LINES_FORBIDDEN'; end if;
  if not exists (select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE') then
    raise exception 'BUSINESS_SCOPE_INVALID';
  end if;
  if p_branch_id is not null and not exists (
    select 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id and b.business_id=p_business_id and b.status='ACTIVE'
  ) then raise exception 'BRANCH_SCOPE_INVALID'; end if;

  for v_input in select value from pg_catalog.jsonb_array_elements(p_lines) as x(value) loop
    v_line_no:=v_line_no+1;
    if pg_catalog.jsonb_typeof(v_input)<>'object' then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    begin
      v_product:=nullif(v_input->>'product_id','')::uuid;
      v_qty:=nullif(v_input->>'ordered_quantity','')::numeric;
      v_cost:=nullif(v_input->>'unit_cost','')::numeric;
    exception when others then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end;
    if v_product is null or v_qty is null or v_qty<=0 or v_qty::text in ('NaN','Infinity','-Infinity')
       or v_cost is null or v_cost<0 or v_cost::text in ('NaN','Infinity','-Infinity') then
      raise exception 'INVALID_PURCHASE_ORDER_LINE';
    end if;
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then
      raise exception 'PRODUCT_INVALID';
    end if;
    v_subtotal:=v_subtotal+(v_qty*v_cost);
  end loop;
  if v_subtotal::text in ('NaN','Infinity','-Infinity') or v_subtotal<0 then raise exception 'INVALID_PURCHASE_ORDER_TOTAL'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_business_id::text||':'||pg_catalog.btrim(p_order_number),0));
  select * into v_order from public.erp_purchase_orders po where po.id=p_id for update;
  if found then
    if v_order.tenant_id is distinct from p_tenant_id or v_order.business_id is distinct from p_business_id
       or v_order.branch_id is distinct from p_branch_id or v_order.order_number is distinct from pg_catalog.btrim(p_order_number)
       or v_order.supplier_id is distinct from pg_catalog.btrim(p_supplier_id)
       or v_order.total_amount is distinct from v_subtotal
       or v_order.tax_amount is distinct from p_tax_amount
       or v_order.discount_amount is distinct from p_discount_amount
       or v_order.reason is distinct from p_reason then raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT'; end if;
    select count(*) into v_existing_count from public.erp_purchase_order_lines l where l.purchase_order_id=p_id;
    if v_existing_count<>pg_catalog.jsonb_array_length(p_lines) then raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT'; end if;
    v_line_no:=0;
    for v_input in select value from pg_catalog.jsonb_array_elements(p_lines) as x(value) loop
      v_line_no:=v_line_no+1;
      select * into v_line from public.erp_purchase_order_lines l where l.purchase_order_id=p_id and l.line_number=v_line_no;
      if not found or v_line.product_id is distinct from (v_input->>'product_id')::uuid
         or v_line.ordered_quantity is distinct from (v_input->>'ordered_quantity')::numeric
         or v_line.unit_cost is distinct from (v_input->>'unit_cost')::numeric
         or v_line.description is distinct from nullif(pg_catalog.btrim(v_input->>'description'),'') then
        raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
      end if;
    end loop;
    return pg_catalog.jsonb_build_object('success',true,'idempotent',true,'order_id',p_id,'line_count',v_existing_count,'line_subtotal',v_subtotal);
  end if;

  if exists(select 1 from public.erp_purchase_orders po where po.business_id=p_business_id and po.order_number=pg_catalog.btrim(p_order_number)) then
    raise exception 'PURCHASE_ORDER_NUMBER_CONFLICT';
  end if;

  insert into public.erp_purchase_orders(
    id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by
  ) values (
    p_id,p_tenant_id,p_business_id,p_branch_id,pg_catalog.btrim(p_order_number),pg_catalog.btrim(p_supplier_id),
    v_subtotal,p_tax_amount,p_discount_amount,'DRAFT',p_reason,p_actor_user_id
  );

  perform public.set_purchase_order_lines_backend(
    p_id,p_tenant_id,p_business_id,p_lines,p_actor_user_id
  );
  return pg_catalog.jsonb_build_object('success',true,'idempotent',false,'order_id',p_id,'line_count',v_line_no,'line_subtotal',v_subtotal,'total_amount',v_subtotal,'tax_amount',p_tax_amount,'discount_amount',p_discount_amount,'status','DRAFT');
end;
$function$;

revoke all on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb,uuid) to service_role;

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
