-- RC442: route remaining ERP mutations through verified Edge identity and service-only RPCs.
-- Keep legacy direct-client EXECUTE revoked; these functions accept an actor only from the verified Edge boundary.
create or replace function public.update_purchase_order_status_service_backend(
  p_order_id varchar, p_target_status varchar, p_actor_user_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_order public.erp_purchase_orders%rowtype;
  v_role text;
  v_next_status text;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(pg_catalog.btrim(p_order_id),'') is null
     or p_target_status not in ('SUBMITTED','APPROVED') then
    raise exception 'INVALID_PURCHASE_ORDER_STATUS_INPUT';
  end if;

  select * into v_order
  from public.erp_purchase_orders po
  where po.id=p_order_id
  for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_actor_user_id
    and m.tenant_id=v_order.tenant_id
    and m.business_id=v_order.business_id
    and m.status='ACTIVE'
  order by m.id
  limit 1;
  if v_role is null then raise exception 'PURCHASE_ORDER_ROLE_REQUIRED'; end if;

  if p_target_status='SUBMITTED' and v_order.status='DRAFT' then
    v_next_status:=case when v_order.total_amount>5000 then 'PENDING_APPROVAL' else 'SUBMITTED' end;
  elsif p_target_status='APPROVED' and v_order.status='PENDING_APPROVAL'
        and v_role in ('OWNER','BUSINESS_OWNER','ADMIN') then
    v_next_status:='APPROVED';
  else
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.erp_purchase_orders
  set status=v_next_status,updated_at=pg_catalog.now()
  where id=v_order.id
  returning * into v_order;
  return pg_catalog.jsonb_build_object('success',true,'order',pg_catalog.to_jsonb(v_order));
end;
$function$;

create or replace function public.create_stock_transfer_service_backend(
  p_id varchar, p_tenant_id varchar, p_business_id uuid, p_transfer_number varchar,
  p_from_warehouse_id varchar, p_to_warehouse_id varchar, p_product_id uuid,
  p_quantity numeric, p_actor_user_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_transfer public.erp_stock_transfers%rowtype;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_quantity is null or p_quantity<=0 or p_quantity::text in ('NaN','Infinity','-Infinity')
     or nullif(pg_catalog.btrim(p_id),'') is null
     or nullif(pg_catalog.btrim(p_tenant_id),'') is null
     or p_business_id is null or p_product_id is null
     or nullif(pg_catalog.btrim(p_transfer_number),'') is null
     or nullif(pg_catalog.btrim(p_from_warehouse_id),'') is null
     or nullif(pg_catalog.btrim(p_to_warehouse_id),'') is null then
    raise exception 'INVALID_TRANSFER_INPUT';
  end if;
  if p_from_warehouse_id=p_to_warehouse_id then raise exception 'SAME_WAREHOUSE'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_id,0));
  select * into v_transfer from public.erp_stock_transfers t where t.id=p_id for update;
  if found then
    if v_transfer.tenant_id=p_tenant_id and v_transfer.business_id=p_business_id
       and v_transfer.transfer_number=p_transfer_number
       and v_transfer.from_warehouse_id=p_from_warehouse_id
       and v_transfer.to_warehouse_id=p_to_warehouse_id
       and v_transfer.product_id=p_product_id
       and v_transfer.quantity=p_quantity
       and v_transfer.created_by=p_actor_user_id then
      return pg_catalog.jsonb_build_object('success',true,'transfer',pg_catalog.to_jsonb(v_transfer),'idempotent',true);
    end if;
    raise exception 'TRANSFER_IDEMPOTENCY_CONFLICT';
  end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_actor_user_id and m.tenant_id=p_tenant_id
    and m.business_id=p_business_id and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF')
  order by m.id limit 1;
  if v_role is null then raise exception 'ERP_INVENTORY_ROLE_REQUIRED'; end if;

  if not exists(select 1 from public.warehouses w where w.id=p_from_warehouse_id and w.tenant_id=p_tenant_id and w.business_id=p_business_id and w.status='ACTIVE') then
    raise exception 'SOURCE_WAREHOUSE_INVALID';
  end if;
  if not exists(select 1 from public.warehouses w where w.id=p_to_warehouse_id and w.tenant_id=p_tenant_id and w.business_id=p_business_id and w.status='ACTIVE') then
    raise exception 'TARGET_WAREHOUSE_INVALID';
  end if;
  if not exists(select 1 from public.catalog_items ci where ci.id=p_product_id and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE') then
    raise exception 'PRODUCT_INVALID';
  end if;

  insert into public.erp_stock_transfers(
    id,tenant_id,business_id,transfer_number,from_warehouse_id,to_warehouse_id,product_id,quantity,status,created_by
  ) values (
    p_id,p_tenant_id,p_business_id,p_transfer_number,p_from_warehouse_id,p_to_warehouse_id,p_product_id,p_quantity,'REQUESTED',p_actor_user_id
  ) returning * into v_transfer;

  return pg_catalog.jsonb_build_object('success',true,'transfer',pg_catalog.to_jsonb(v_transfer),'idempotent',false);
exception
  when unique_violation then raise exception 'TRANSFER_NUMBER_CONFLICT';
end;
$function$;

create or replace function public.update_stock_transfer_status_service_backend(
  p_transfer_id varchar, p_target_status varchar, p_actor_user_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_transfer public.erp_stock_transfers%rowtype;
  v_role text;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(pg_catalog.btrim(p_transfer_id),'') is null
     or p_target_status not in ('APPROVED','IN_TRANSIT') then
    raise exception 'INVALID_TRANSFER_STATUS_INPUT';
  end if;

  select * into v_transfer
  from public.erp_stock_transfers t
  where t.id=p_transfer_id
  for update;
  if not found then raise exception 'TRANSFER_NOT_FOUND'; end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_actor_user_id
    and m.tenant_id=v_transfer.tenant_id
    and m.business_id=v_transfer.business_id
    and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF')
  order by m.id limit 1;
  if v_role is null then raise exception 'ERP_INVENTORY_ROLE_REQUIRED'; end if;

  if p_target_status='APPROVED' and v_transfer.status<>'REQUESTED' then
    raise exception 'INVALID_STATUS_TRANSITION';
  elsif p_target_status='IN_TRANSIT' and v_transfer.status<>'APPROVED' then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.erp_stock_transfers
  set status=p_target_status,updated_at=pg_catalog.now()
  where id=p_transfer_id returning * into v_transfer;
  return pg_catalog.jsonb_build_object('success',true,'transfer',pg_catalog.to_jsonb(v_transfer));
end;
$function$;

create or replace function public.receive_stock_transfer_service_backend(
  p_transfer_id varchar, p_actor_user_id uuid
) returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_transfer public.erp_stock_transfers%rowtype;
  v_source public.stock_balances%rowtype;
  v_destination public.stock_balances%rowtype;
  v_role text;
  v_row jsonb;
begin
  if p_actor_user_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if nullif(pg_catalog.btrim(p_transfer_id),'') is null then raise exception 'INVALID_TRANSFER_ID'; end if;

  select * into v_transfer
  from public.erp_stock_transfers t
  where t.id=p_transfer_id
  for update;
  if not found then raise exception 'TRANSFER_NOT_FOUND'; end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_actor_user_id
    and m.tenant_id=v_transfer.tenant_id
    and m.business_id=v_transfer.business_id
    and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF')
  order by m.id limit 1;
  if v_role is null then raise exception 'ERP_INVENTORY_ROLE_REQUIRED'; end if;

  if v_transfer.status='COMPLETED' then
    return pg_catalog.jsonb_build_object('success',true,'transfer',pg_catalog.to_jsonb(v_transfer),'idempotent',true);
  end if;
  if v_transfer.status<>'IN_TRANSIT' then raise exception 'TRANSFER_NOT_IN_TRANSIT'; end if;

  -- Serialize stock mutations for this product and warehouse pair; lock existing balances in stable order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_transfer.tenant_id||'|'||v_transfer.business_id::text||'|'||v_transfer.product_id::text||'|'||
    least(v_transfer.from_warehouse_id,v_transfer.to_warehouse_id)||'|'||
    greatest(v_transfer.from_warehouse_id,v_transfer.to_warehouse_id),0
  ));
  perform 1
  from public.stock_balances sb
  where sb.tenant_id=v_transfer.tenant_id and sb.business_id=v_transfer.business_id
    and sb.product_id=v_transfer.product_id
    and sb.warehouse_id in (v_transfer.from_warehouse_id,v_transfer.to_warehouse_id)
  order by sb.warehouse_id
  for update;

  select * into v_source from public.stock_balances sb
  where sb.tenant_id=v_transfer.tenant_id and sb.business_id=v_transfer.business_id
    and sb.warehouse_id=v_transfer.from_warehouse_id and sb.product_id=v_transfer.product_id;
  if not found then raise exception 'SOURCE_STOCK_NOT_INITIALIZED'; end if;
  if v_source.quantity_on_hand-v_source.quantity_reserved<v_transfer.quantity then
    raise exception 'INSUFFICIENT_AVAILABLE_STOCK';
  end if;

  select * into v_destination from public.stock_balances sb
  where sb.tenant_id=v_transfer.tenant_id and sb.business_id=v_transfer.business_id
    and sb.warehouse_id=v_transfer.to_warehouse_id and sb.product_id=v_transfer.product_id;
  if not found then
    insert into public.stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
    select 'sb-'||pg_catalog.gen_random_uuid()::text,v_transfer.tenant_id,v_transfer.business_id,w.branch_id,
      v_transfer.to_warehouse_id,v_transfer.product_id,0,0
    from public.warehouses w
    where w.id=v_transfer.to_warehouse_id and w.tenant_id=v_transfer.tenant_id and w.business_id=v_transfer.business_id
    returning * into v_destination;
    if not found then raise exception 'TARGET_WAREHOUSE_INVALID'; end if;
  end if;

  update public.stock_balances
  set quantity_on_hand=quantity_on_hand-v_transfer.quantity,updated_at=pg_catalog.now()
  where id=v_source.id;
  update public.stock_balances
  set quantity_on_hand=quantity_on_hand+v_transfer.quantity,updated_at=pg_catalog.now()
  where id=v_destination.id;

  insert into public.inventory_transactions(
    id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by
  )
  select 'it-'||pg_catalog.gen_random_uuid()::text,v_transfer.tenant_id,v_transfer.business_id,w.branch_id,
    v_transfer.from_warehouse_id,v_transfer.product_id,'TRANSFER_OUT',-v_transfer.quantity,0,v_transfer.id,p_actor_user_id
  from public.warehouses w
  where w.id=v_transfer.from_warehouse_id and w.tenant_id=v_transfer.tenant_id and w.business_id=v_transfer.business_id;
  insert into public.inventory_transactions(
    id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by
  )
  select 'it-'||pg_catalog.gen_random_uuid()::text,v_transfer.tenant_id,v_transfer.business_id,w.branch_id,
    v_transfer.to_warehouse_id,v_transfer.product_id,'TRANSFER_IN',v_transfer.quantity,0,v_transfer.id,p_actor_user_id
  from public.warehouses w
  where w.id=v_transfer.to_warehouse_id and w.tenant_id=v_transfer.tenant_id and w.business_id=v_transfer.business_id;

  update public.erp_stock_transfers
  set status='COMPLETED',updated_at=pg_catalog.now()
  where id=v_transfer.id returning * into v_transfer;
  v_row:=pg_catalog.to_jsonb(v_transfer);
  return pg_catalog.jsonb_build_object('success',true,'transfer',v_row,'idempotent',false);
end;
$function$;

revoke all on function public.update_purchase_order_status_service_backend(varchar,varchar,uuid) from public,anon,authenticated;
revoke all on function public.create_stock_transfer_service_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,uuid) from public,anon,authenticated;
revoke all on function public.update_stock_transfer_status_service_backend(varchar,varchar,uuid) from public,anon,authenticated;
revoke all on function public.receive_stock_transfer_service_backend(varchar,uuid) from public,anon,authenticated;
grant execute on function public.update_purchase_order_status_service_backend(varchar,varchar,uuid) to service_role;
grant execute on function public.create_stock_transfer_service_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,uuid) to service_role;
grant execute on function public.update_stock_transfer_status_service_backend(varchar,varchar,uuid) to service_role;
grant execute on function public.receive_stock_transfer_service_backend(varchar,uuid) to service_role;
