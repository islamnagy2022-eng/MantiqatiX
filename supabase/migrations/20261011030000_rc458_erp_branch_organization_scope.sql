-- RC458: enforce branch and organization isolation across ERP purchase operations.
-- RC437/RC438 source is immutable; this forward migration replaces only the authorization checks.
do $rc458_preflight$
begin
  if to_regprocedure('public.set_purchase_order_lines_backend(character varying,character varying,uuid,jsonb,uuid)') is null
     or to_regprocedure('public.receive_purchase_stock_with_order_line_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)') is null
     or to_regprocedure('public.create_purchase_order_with_lines_backend(character varying,character varying,uuid,character varying,character varying,character varying,numeric,numeric,text,jsonb,uuid)') is null
     or to_regprocedure('public.update_purchase_order_status_backend(character varying,character varying)') is null then
    raise exception 'RC458 prerequisites missing: apply RC437 and RC438 before ERP branch-scope hardening';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_memberships' and column_name='branch_id')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='user_memberships' and column_name='organization_id')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='organization_id')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='branches' and column_name='organization_id') then
    raise exception 'RC458 schema prerequisites missing: branch/organization scope columns are required';
  end if;
end;
$rc458_preflight$;

create or replace function public.create_purchase_order_with_lines_backend(
  p_id varchar,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_order_number varchar,
  p_supplier_id varchar,p_tax_amount numeric,p_discount_amount numeric,p_reason text,p_lines jsonb,p_actor_user_id uuid
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  u uuid:=p_actor_user_id; v_role text; v_line jsonb; v_product uuid; v_qty numeric; v_cost numeric;
  v_subtotal numeric:=0; v_total numeric; v_tax numeric:=round(coalesce(p_tax_amount,0),2);
  v_discount numeric:=round(coalesce(p_discount_amount,0),2); v_existing public.erp_purchase_orders%rowtype;
  v_created public.erp_purchase_orders%rowtype; v_line_count integer:=0;
  v_business_org_id varchar; v_branch_org_id varchar; v_target_org varchar;
begin
  if u is null then raise exception 'UNAUTHENTICATED'; end if;
  if coalesce(length(pg_catalog.btrim(p_id)),0)<8 or length(p_id)>128
     or coalesce(length(pg_catalog.btrim(p_order_number)),0)<1 or length(p_order_number)>128
     or coalesce(length(pg_catalog.btrim(p_supplier_id)),0)<1 or length(p_supplier_id)>128
     or (p_reason is not null and length(p_reason)>2000) or p_business_id is null
     or coalesce(length(pg_catalog.btrim(p_tenant_id)),0)<1 then raise exception 'INVALID_PURCHASE_ORDER'; end if;
  if v_tax<0 or v_discount<0 or v_tax::text in ('NaN','Infinity','-Infinity') or v_discount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_PURCHASE_ORDER_TOTALS';
  end if;
  if coalesce(pg_catalog.jsonb_typeof(p_lines),'null')<>'array' then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
  if pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>200 then raise exception 'PURCHASE_ORDER_LINES_REQUIRED'; end if;
  select upper(m.role) into v_role from public.user_memberships m
  where m.user_id=u and m.tenant_id=p_tenant_id and m.business_id=p_business_id and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE') limit 1;
  if v_role is null then
    raise exception 'PURCHASE_ORDER_ROLE_REQUIRED';
  end if;
  if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE') then raise exception 'BUSINESS_INVALID'; end if;
  if p_branch_id is not null and not exists(select 1 from public.branches b where b.id=p_branch_id and b.tenant_id=p_tenant_id and b.business_id=p_business_id and b.status='ACTIVE') then raise exception 'BRANCH_INVALID'; end if;
  select b.organization_id into v_business_org_id from public.businesses b
  where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE';
  if not found then raise exception 'BUSINESS_INVALID'; end if;
  if p_branch_id is not null then
    select br.organization_id into v_branch_org_id from public.branches br
    where br.id=p_branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id and br.status='ACTIVE';
    if not found then raise exception 'BRANCH_INVALID'; end if;
  end if;
  if v_business_org_id is not null and v_branch_org_id is not null and v_business_org_id is distinct from v_branch_org_id then
    raise exception 'BRANCH_ORGANIZATION_MISMATCH';
  end if;
  v_target_org:=coalesce(v_branch_org_id,v_business_org_id);
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=u and m.tenant_id=p_tenant_id and m.business_id=p_business_id and m.status='ACTIVE'
      and (m.branch_id is null or m.branch_id=p_branch_id)
      and (m.organization_id is null or m.organization_id=v_target_org)
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) then raise exception 'PURCHASE_ORDER_BRANCH_FORBIDDEN'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id,438));
  select * into v_existing from public.erp_purchase_orders po where po.id=p_id for update;
  if found then
    if v_existing.tenant_id<>p_tenant_id or v_existing.business_id<>p_business_id or v_existing.order_number<>pg_catalog.btrim(p_order_number)
       or v_existing.supplier_id<>pg_catalog.btrim(p_supplier_id) or v_existing.branch_id is distinct from p_branch_id or v_existing.tax_amount is distinct from v_tax
       or v_existing.discount_amount is distinct from v_discount or v_existing.reason is distinct from p_reason
       or v_existing.total_amount is distinct from round((select coalesce(sum(round(pol.ordered_quantity*pol.unit_cost,2)),0) from public.erp_purchase_order_lines pol where pol.purchase_order_id=p_id)+v_tax-v_discount,2) then
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
          and pol.ordered_quantity=coalesce((incoming.value->>'quantity')::numeric,(incoming.value->>'ordered_quantity')::numeric)
          and pol.unit_cost=(incoming.value->>'unit_cost')::numeric
          and pol.description is not distinct from nullif(pg_catalog.btrim(incoming.value->>'description'),'')
      )
    ) then raise exception 'PURCHASE_ORDER_IDEMPOTENCY_CONFLICT'; end if;
    return pg_catalog.jsonb_build_object('success',true,'idempotent',true,'order',pg_catalog.to_jsonb(v_existing));
  end if;

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    if pg_catalog.jsonb_typeof(v_line)<>'object' then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    begin
      v_product:=nullif(v_line->>'product_id','')::uuid; v_qty:=coalesce(nullif(v_line->>'quantity',''),nullif(v_line->>'ordered_quantity',''))::numeric; v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    exception when others then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end;
    if v_product is null or v_qty is null or v_qty<=0 or v_cost is null or v_cost<0
       or v_qty::text in ('NaN','Infinity','-Infinity') or v_cost::text in ('NaN','Infinity','-Infinity')
       or v_qty<>round(v_qty,4) or v_cost<>round(v_cost,4)
       or length(coalesce(v_line->>'description',''))>500 then raise exception 'INVALID_PURCHASE_ORDER_LINE'; end if;
    if (select count(*) from pg_catalog.jsonb_array_elements(p_lines) as all_lines(value)
      where all_lines.value->>'product_id'=v_product::text)>1 then raise exception 'DUPLICATE_PURCHASE_ORDER_PRODUCT'; end if;
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then
      raise exception 'PRODUCT_INVALID';
    end if;
    v_subtotal:=v_subtotal+round(v_qty*v_cost,2); v_line_count:=v_line_count+1;
  end loop;
  if v_subtotal<=0 or v_discount>v_subtotal+v_tax then raise exception 'INVALID_PURCHASE_ORDER_TOTALS'; end if;
  v_total:=round(v_subtotal+v_tax-v_discount,2);
  if exists(select 1 from public.erp_purchase_orders po where po.business_id=p_business_id and po.order_number=p_order_number) then
    raise exception 'PURCHASE_ORDER_NUMBER_CONFLICT';
  end if;

  insert into public.erp_purchase_orders(id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by)
  values(p_id,p_tenant_id,p_business_id,p_branch_id,pg_catalog.btrim(p_order_number),pg_catalog.btrim(p_supplier_id),v_total,v_tax,v_discount,'DRAFT',p_reason,u)
  returning * into v_created;

  v_line_count:=0;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    v_line_count:=v_line_count+1;
    v_product:=nullif(v_line->>'product_id','')::uuid; v_qty:=coalesce(nullif(v_line->>'quantity',''),nullif(v_line->>'ordered_quantity',''))::numeric; v_cost:=nullif(v_line->>'unit_cost','')::numeric;
    insert into public.erp_purchase_order_lines(id,tenant_id,business_id,purchase_order_id,line_number,product_id,ordered_quantity,received_quantity,unit_cost,description)
    values(p_id||'-line-'||v_line_count::text,p_tenant_id,p_business_id,p_id,v_line_count,v_product,v_qty,0,v_cost,nullif(pg_catalog.btrim(v_line->>'description'),''));
  end loop;
  return pg_catalog.jsonb_build_object('success',true,'idempotent',false,'order',pg_catalog.to_jsonb(v_created),'line_count',v_line_count);
end;
$function$;

revoke all on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb,uuid) to service_role;

create or replace function public.update_purchase_order_status_backend(p_order_id varchar,p_target_status varchar)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare u uuid:=auth.uid(); v_role text; v_order public.erp_purchase_orders%rowtype; v_next text; v_business_org_id varchar; v_branch_org_id varchar; v_target_org varchar;
begin
  if u is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_order from public.erp_purchase_orders po where po.id=p_order_id for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;
  select b.organization_id into v_business_org_id from public.businesses b
  where b.id=v_order.business_id and b.tenant_id=v_order.tenant_id and b.status='ACTIVE';
  if not found then raise exception 'BUSINESS_INVALID'; end if;
  if v_order.branch_id is not null then
    select br.organization_id into v_branch_org_id from public.branches br
    where br.id=v_order.branch_id and br.tenant_id=v_order.tenant_id and br.business_id=v_order.business_id and br.status='ACTIVE';
    if not found then raise exception 'BRANCH_SCOPE_INVALID'; end if;
  end if;
  if v_business_org_id is not null and v_branch_org_id is not null and v_business_org_id is distinct from v_branch_org_id then
    raise exception 'BRANCH_ORGANIZATION_MISMATCH';
  end if;
  v_target_org:=coalesce(v_branch_org_id,v_business_org_id);
  select upper(m.role) into v_role from public.user_memberships m
  where m.user_id=u and m.tenant_id=v_order.tenant_id and m.business_id=v_order.business_id and m.status='ACTIVE'
    and (m.branch_id is null or m.branch_id=v_order.branch_id)
    and (m.organization_id is null or m.organization_id=v_target_org) limit 1;
  if v_role is null or v_role not in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then raise exception 'PURCHASE_ORDER_ROLE_REQUIRED'; end if;
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
  v_business_org_id varchar;
  v_branch_org_id varchar;
  v_target_org varchar;
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
  select b.organization_id into v_business_org_id from public.businesses b
  where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE';
  if not found then raise exception 'BUSINESS_SCOPE_INVALID'; end if;
  if v_order.branch_id is not null then
    select br.organization_id into v_branch_org_id from public.branches br
    where br.id=v_order.branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id and br.status='ACTIVE';
    if not found then raise exception 'BRANCH_SCOPE_INVALID'; end if;
  end if;
  if v_business_org_id is not null and v_branch_org_id is not null and v_business_org_id is distinct from v_branch_org_id then
    raise exception 'BRANCH_ORGANIZATION_MISMATCH';
  end if;
  v_target_org:=coalesce(v_branch_org_id,v_business_org_id);
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE'
      and (m.branch_id is null or m.branch_id=v_order.branch_id)
      and (m.organization_id is null or m.organization_id=v_target_org)
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','PURCHASING','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) then raise exception 'PURCHASE_ORDER_LINES_BRANCH_FORBIDDEN'; end if;
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
       or v_cost is null or v_cost<0 or v_cost::text in ('NaN','Infinity','-Infinity')
       or v_qty<>round(v_qty,4) or v_cost<>round(v_cost,4)
       or length(coalesce(v_line->>'description',''))>500 then
      raise exception 'INVALID_PURCHASE_ORDER_LINE';
    end if;
    if v_product=any(v_seen) then raise exception 'DUPLICATE_PURCHASE_ORDER_PRODUCT'; end if;
    v_seen:=pg_catalog.array_append(v_seen,v_product);
    if not exists(select 1 from public.catalog_items ci where ci.id=v_product and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then
      raise exception 'PRODUCT_INVALID';
    end if;
    v_total:=v_total+round(v_qty*v_cost,2);
  end loop;

  if v_total<=0 or v_order.discount_amount>v_total+v_order.tax_amount then raise exception 'INVALID_PURCHASE_ORDER_TOTALS'; end if;
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
  update public.erp_purchase_orders
  set total_amount=round(v_total+tax_amount-discount_amount,2),updated_at=pg_catalog.now()
  where id=p_order_id and tenant_id=p_tenant_id and business_id=p_business_id;
  return pg_catalog.jsonb_build_object('success',true,'order_id',p_order_id,'line_count',v_line_number,'line_subtotal',v_total,
    'total_amount',round(v_total+v_order.tax_amount-v_order.discount_amount,2));
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
  v_order public.erp_purchase_orders%rowtype;
  v_warehouse public.warehouses%rowtype;
  v_business_org_id varchar;
  v_branch_org_id varchar;
  v_target_org varchar;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_order from public.erp_purchase_orders po
  where po.id=p_purchase_order_id and po.tenant_id=p_tenant_id and po.business_id=p_business_id for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;
  if upper(v_order.status)<>'APPROVED' then raise exception 'PURCHASE_ORDER_NOT_APPROVED'; end if;
  select * into v_warehouse from public.warehouses w
  where w.id=p_warehouse_id and w.tenant_id=p_tenant_id and w.business_id=p_business_id and w.status='ACTIVE' for share;
  if not found then raise exception 'WAREHOUSE_INVALID'; end if;
  if v_order.branch_id is not null and v_order.branch_id is distinct from v_warehouse.branch_id then
    raise exception 'PURCHASE_ORDER_WAREHOUSE_BRANCH_MISMATCH';
  end if;
  select b.organization_id into v_business_org_id from public.businesses b
  where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE';
  if not found then raise exception 'BUSINESS_SCOPE_INVALID'; end if;
  if v_warehouse.branch_id is not null then
    select br.organization_id into v_branch_org_id from public.branches br
    where br.id=v_warehouse.branch_id and br.tenant_id=p_tenant_id and br.business_id=p_business_id and br.status='ACTIVE';
    if not found then raise exception 'BRANCH_SCOPE_INVALID'; end if;
  end if;
  if v_business_org_id is not null and v_branch_org_id is not null and v_business_org_id is distinct from v_branch_org_id then
    raise exception 'BRANCH_ORGANIZATION_MISMATCH';
  end if;
  v_target_org:=coalesce(v_branch_org_id,v_business_org_id);
  if not exists (
    select 1 from public.user_memberships m
    where m.user_id=p_actor_user_id and m.tenant_id=p_tenant_id and m.business_id=p_business_id
      and m.status='ACTIVE'
      and (m.branch_id is null or m.branch_id=v_warehouse.branch_id)
      and (m.organization_id is null or m.organization_id=v_target_org)
      and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  ) then raise exception 'PURCHASE_RECEIVING_BRANCH_FORBIDDEN'; end if;

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

  -- Recheck after taking the order-line lock. A concurrent request with the same
  -- receipt number may have committed while this request waited for that lock.
  -- Replay must be resolved before checking the remaining quantity, or a valid
  -- retry can be rejected after the first request fills the line.
  select * into v_existing from public.erp_purchase_receipts r
  where r.business_id=p_business_id and r.receipt_number=p_receipt_number for update;
  if found then
    v_result:=public.receive_purchase_stock_atomic_backend(
      p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,
      p_received_quantity,p_unit_cost,p_actor_user_id
    );
    if coalesce((v_result->>'success')::boolean,false) is not true
       or coalesce((v_result->>'idempotent')::boolean,false) is not true then
      raise exception 'PURCHASE_RECEIPT_REPLAY_NOT_IDEMPOTENT';
    end if;
    return v_result||pg_catalog.jsonb_build_object(
      'order_line_id',v_line.id,'order_line_received_quantity',v_line.received_quantity
    );
  end if;

  if v_line.received_quantity+p_received_quantity>v_line.ordered_quantity then raise exception 'PURCHASE_ORDER_QUANTITY_EXCEEDED'; end if;
  if p_unit_cost is distinct from v_line.unit_cost then raise exception 'PURCHASE_ORDER_UNIT_COST_MISMATCH'; end if;

  v_result:=public.receive_purchase_stock_atomic_backend(
    p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,
    p_received_quantity,p_unit_cost,p_actor_user_id
  );
  if coalesce((v_result->>'success')::boolean,false) is not true then raise exception 'PURCHASE_RECEIPT_FAILED'; end if;
  -- Another transaction may have created the same receipt after our first lookup.
  -- RC434 returns idempotent=true for that race; do not increment the order line again.
  if coalesce((v_result->>'idempotent')::boolean,false) is true then
    return v_result||pg_catalog.jsonb_build_object(
      'order_line_id',v_line.id,'order_line_received_quantity',v_line.received_quantity
    );
  end if;
  update public.erp_purchase_order_lines
  set received_quantity=received_quantity+p_received_quantity,updated_at=pg_catalog.now()
  where id=v_line.id and received_quantity+p_received_quantity<=ordered_quantity;
  if not found then raise exception 'PURCHASE_ORDER_QUANTITY_EXCEEDED'; end if;
  return v_result||pg_catalog.jsonb_build_object('order_line_id',v_line.id,'order_line_received_quantity',v_line.received_quantity+p_received_quantity);
end;
$function$;

revoke all on function public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) from public,anon,authenticated;
grant execute on function public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) to service_role;

comment on function public.create_purchase_order_with_lines_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,text,jsonb,uuid) is
  'RC458: purchase order creation is scoped to active business, branch, and organization membership.';
comment on function public.update_purchase_order_status_backend(varchar,varchar) is
  'RC458: purchase order status transitions enforce branch and organization membership.';
comment on function public.set_purchase_order_lines_backend(varchar,varchar,uuid,jsonb,uuid) is
  'RC458: purchase order line edits enforce branch and organization membership.';
comment on function public.receive_purchase_stock_with_order_line_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) is
  'RC458: purchase receiving enforces warehouse branch and organization scope before replay or stock mutation.';
