-- DEMO-only stock reservation is atomic with public.create_order_backend inserts.
-- Stock values live in catalog_items.metadata.demo_stock and are synthetic.
-- Cancellation restores demo stock; no LIVE order/table is affected.

create or replace function private.mantiqatix_demo_reserve_catalog_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_stock numeric;
  v_metadata jsonb;
begin
  if new.tenant_id is distinct from 'MNTY-PLATFORM'
     or coalesce(new.metadata->>'environment','') <> 'DEMO' then
    return new;
  end if;

  for v_line in
    select value from pg_catalog.jsonb_array_elements(coalesce(new.pricing_snapshot,new.items_json,'[]'::jsonb))
  loop
    v_item_id := nullif(v_line->>'catalog_item_id','')::uuid;
    v_qty := nullif(v_line->>'quantity','')::numeric;
    if v_item_id is null or v_qty is null or v_qty<=0 then
      raise exception 'DEMO_INVALID_STOCK_LINE';
    end if;

    select ci.metadata into v_metadata
    from public.catalog_items ci
    where ci.id=v_item_id and ci.tenant_id='MNTY-PLATFORM'
      and ci.business_id=new.business_id and ci.branch_id is not distinct from new.branch_id
      and ci.status='ACTIVE'
    for update;
    if not found then raise exception 'DEMO_STOCK_ITEM_NOT_FOUND'; end if;

    v_stock := nullif(v_metadata->>'demo_stock','')::numeric;
    if v_stock is null or v_stock<0 then raise exception 'DEMO_STOCK_NOT_CONFIGURED'; end if;
    if v_qty>v_stock then raise exception 'DEMO_INSUFFICIENT_STOCK'; end if;

    update public.catalog_items
      set metadata=coalesce(v_metadata,'{}'::jsonb) || pg_catalog.jsonb_build_object('demo_stock',v_stock-v_qty),
          updated_at=now()
    where id=v_item_id and tenant_id='MNTY-PLATFORM';
  end loop;
  return new;
end;
$function$;

revoke all on function private.mantiqatix_demo_reserve_catalog_stock() from public,anon,authenticated;

drop trigger if exists mantiqatix_demo_reserve_catalog_stock on public.orders;
create trigger mantiqatix_demo_reserve_catalog_stock
before insert on public.orders
for each row
when (new.tenant_id='MNTY-PLATFORM')
execute function private.mantiqatix_demo_reserve_catalog_stock();

create or replace function private.mantiqatix_demo_restore_catalog_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_line jsonb;
  v_item_id uuid;
  v_qty numeric;
  v_metadata jsonb;
  v_stock numeric;
begin
  if new.tenant_id is distinct from 'MNTY-PLATFORM'
     or coalesce(new.metadata->>'environment','') <> 'DEMO'
     or old.status='CANCELLED' or new.status<>'CANCELLED' then
    return new;
  end if;

  for v_line in
    select value from pg_catalog.jsonb_array_elements(coalesce(new.pricing_snapshot,new.items_json,'[]'::jsonb))
  loop
    v_item_id := nullif(v_line->>'catalog_item_id','')::uuid;
    v_qty := nullif(v_line->>'quantity','')::numeric;
    if v_item_id is null or v_qty is null or v_qty<=0 then
      raise exception 'DEMO_INVALID_STOCK_LINE';
    end if;

    select ci.metadata into v_metadata
    from public.catalog_items ci
    where ci.id=v_item_id and ci.tenant_id='MNTY-PLATFORM'
      and ci.business_id=new.business_id and ci.branch_id is not distinct from new.branch_id
    for update;
    if not found then raise exception 'DEMO_STOCK_ITEM_NOT_FOUND'; end if;

    v_stock := coalesce(nullif(v_metadata->>'demo_stock','')::numeric,0);
    update public.catalog_items
      set metadata=coalesce(v_metadata,'{}'::jsonb) || pg_catalog.jsonb_build_object('demo_stock',v_stock+v_qty),
          updated_at=now()
    where id=v_item_id and tenant_id='MNTY-PLATFORM';
  end loop;
  return new;
end;
$function$;

revoke all on function private.mantiqatix_demo_restore_catalog_stock() from public,anon,authenticated;

drop trigger if exists mantiqatix_demo_restore_catalog_stock on public.orders;
create trigger mantiqatix_demo_restore_catalog_stock
after update of status on public.orders
for each row
when (new.tenant_id='MNTY-PLATFORM' and old.status is distinct from new.status)
execute function private.mantiqatix_demo_restore_catalog_stock();
