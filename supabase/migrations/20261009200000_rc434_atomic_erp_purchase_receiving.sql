-- RC434: atomic, actor-bound ERP purchase receiving.
-- Replaces the Edge Function's multi-request stock/receipt/ledger mutation with one transaction.
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

revoke all on function public.receive_purchase_stock_atomic_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) from public,anon,authenticated;
grant execute on function public.receive_purchase_stock_atomic_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) to service_role;

comment on function public.receive_purchase_stock_atomic_backend(varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric,uuid) is
  'RC434: atomically validates actor/tenant/approved order and applies purchase receipt, stock balance, and inventory ledger; idempotent by business receipt number.';
