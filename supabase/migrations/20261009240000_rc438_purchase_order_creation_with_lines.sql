-- RC438: create purchase orders with explicit lines and calculated server-side totals.
-- Depends on RC437's line schema and line-aware receiving wrapper.
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
  if pg_catalog.jsonb_typeof(p_lines)<>'array' or pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>200 then
    raise exception 'PURCHASE_ORDER_LINES_REQUIRED';
  end if;
  select upper(m.role) into v_role from public.user_memberships m
  where m.user_id=u and m.tenant_id=p_tenant_id and m.business_id=p_business_id and m.status='ACTIVE' limit 1;
  if v_role is null or v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
    raise exception 'PURCHASE_ORDER_ROLE_REQUIRED';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE') then raise exception 'BUSINESS_INVALID'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.business_id=p_business_id) then raise exception 'BRANCH_INVALID'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id,438));
  select * into v_existing from public.erp_purchase_orders po where po.id=p_id for update;
  if found then
    if v_existing.tenant_id<>p_tenant_id or v_existing.business_id<>p_business_id or v_existing.order_number<>p_order_number
       or v_existing.supplier_id<>p_supplier_id or v_existing.tax_amount is distinct from v_tax
       or v_existing.discount_amount is distinct from v_discount or v_existing.reason is distinct from p_reason then
      raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
    end if;
    if (select count(*) from public.erp_purchase_order_lines pol where pol.purchase_order_id=p_id) <> pg_catalog.jsonb_array_length(p_lines) then
      raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_array_elements(p_lines) as incoming(value)
      where not exists (
        select 1 from public.erp_purchase_order_lines pol
        where pol.purchase_order_id=p_id and pol.product_id=(incoming.value->>'product_id')::uuid
          and pol.ordered_quantity=(incoming.value->>'quantity')::numeric
          and pol.unit_cost=(incoming.value->>'unit_cost')::numeric
      )
    ) then raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT'; end if;
    return pg_catalog.jsonb_build_object('success',true,'idempotent',true,'order',pg_catalog.to_jsonb(v_existing));
  end if;

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    if pg_catalog.jsonb_typeof(v_line)<>'object' then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    begin
      v_product:=nullif(v_line->>'product_id','')::uuid; v_qty:=nullif(v_line->>'quantity','')::numeric; v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    exception when others then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end;
    if v_product is null or v_qty is null or v_qty<=0 or v_cost is null or v_cost<=0
       or v_qty::text in ('NaN','Infinity','-Infinity') or v_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(p_lines) as all_lines(value)
      where all_lines.value->>'product_id'=v_product::text and all_lines.value<>v_line) then raise exception 'DUPLICATE_PURCHASE_ORDER_PRODUCT'; end if;
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then
      raise exception 'PRODUCT_INVALID';
    end if;
    v_subtotal:=v_subtotal+round(v_qty*v_cost,2); v_line_count:=v_line_count+1;
  end loop;
  if v_subtotal<=0 or v_discount>v_subtotal+v_tax then raise exception 'INVALID_PURCHASE_ORDER_TOTALS'; end if;
  v_total:=round(v_subtotal+v_tax-v_discount,2);

  insert into public.erp_purchase_orders(id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by)
  values(p_id,p_tenant_id,p_business_id,p_branch_id,p_order_number,p_supplier_id,v_total,v_tax,v_discount,'DRAFT',p_reason,u)
  returning * into v_created;

  v_line_count:=0;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    v_line_count:=v_line_count+1;
    v_product:=nullif(v_line->>'product_id','')::uuid; v_qty:=nullif(v_line->>'quantity','')::numeric; v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    insert into public.erp_purchase_order_lines(id,tenant_id,business_id,purchase_order_id,line_number,product_id,ordered_quantity,received_quantity,unit_cost,description)
    values(p_id||'-line-'||v_line_count::text,p_tenant_id,p_business_id,p_id,v_line_count,v_product,v_qty,0,v_cost,nullif(pg_catalog.btrim(v_line->>'description'),''));
  end loop;
  return pg_catalog.jsonb_build_object('success',true,'idempotent',false,'order',pg_catalog.to_jsonb(v_created),'line_count',v_line_count);
end;
$function$;
revoke all on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb) from public,anon;
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
    v_next:=case when v_order.total_amount>5000 then 'PENDING_APPROVAL' else 'APPROVED' end;
  elsif p_target_status='APPROVED' and v_order.status='PENDING_APPROVAL' and v_role in ('OWNER','BUSINESS_OWNER','ADMIN') then
    if not exists(select 1 from public.erp_purchase_order_lines pol where pol.purchase_order_id=v_order.id and pol.tenant_id=v_order.tenant_id and pol.business_id=v_order.business_id) then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
    v_next:='APPROVED';
  else raise exception 'INVALID_STATUS_TRANSITION'; end if;
  update public.erp_purchase_orders set status=v_next,updated_at=pg_catalog.now() where id=v_order.id returning * into v_order;
  return pg_catalog.jsonb_build_object('success',true,'order',pg_catalog.to_jsonb(v_order));
end;
$function$;
revoke all on function public.update_purchase_order_status_backend(varchar,varchar) from public,anon;
grant execute on function public.update_purchase_order_status_backend(varchar,varchar) to authenticated;

comment on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb) is
  'RC438: creates purchase order and line items atomically; totals are computed from validated products and quantities.';
