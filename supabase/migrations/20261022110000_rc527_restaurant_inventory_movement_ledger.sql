-- RC527: auditable, idempotent stock movements for restaurant inventory.
-- No direct client writes are granted to the movement ledger.
create table if not exists public.restaurant_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id text not null references public.restaurant_inventory(id) on delete restrict,
  tenant_id character varying not null,
  business_id uuid not null,
  branch_id character varying not null,
  movement_type text not null check (movement_type in ('RECEIPT','ISSUE','OPENING_BALANCE')),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost_egp numeric(14,2) not null default 0 check (unit_cost_egp >= 0),
  idempotency_key text not null,
  notes text not null default '',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint restaurant_inventory_movements_idempotency_unique
    unique (tenant_id, business_id, branch_id, idempotency_key)
);

create index if not exists restaurant_inventory_movements_scope_history_idx
  on public.restaurant_inventory_movements
  (tenant_id, business_id, branch_id, inventory_id, created_at desc);

-- Close direct PostgREST balance/cost writes. Only trusted SECURITY DEFINER
-- database code may change the balance or valuation; client-created items start at zero.
create or replace function public.guard_restaurant_inventory_balance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if current_user = 'postgres' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.current_stock_qty,0) <> 0 or coalesce(new.unit_cost_egp,0) <> 0 then
      raise exception 'Initial stock and cost must be recorded through an audited movement';
    end if;
  elsif new.current_stock_qty is distinct from old.current_stock_qty
     or new.unit_cost_egp is distinct from old.unit_cost_egp then
    raise exception 'Stock balance and unit cost require an audited movement';
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_restaurant_inventory_balance() from public, anon, authenticated;
drop trigger if exists restaurant_inventory_balance_audit_guard on public.restaurant_inventory;
create trigger restaurant_inventory_balance_audit_guard
before insert or update on public.restaurant_inventory
for each row execute function public.guard_restaurant_inventory_balance();


alter table public.restaurant_inventory_movements enable row level security;
alter table public.restaurant_inventory_movements force row level security;
revoke all on table public.restaurant_inventory_movements from public, anon, authenticated;
grant select on table public.restaurant_inventory_movements to authenticated;

create policy restaurant_inventory_movements_membership_select
on public.restaurant_inventory_movements
for select
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory_movements.tenant_id
      and m.business_id = restaurant_inventory_movements.business_id
      and m.branch_id = restaurant_inventory_movements.branch_id
      and upper(m.role) in (
        'OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF',
        'SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS'
      )
  )
);

create or replace function public.restaurant_inventory_move(
  p_inventory_id text,
  p_movement_type text,
  p_quantity numeric,
  p_unit_cost_egp numeric,
  p_idempotency_key text,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_type text := upper(trim(coalesce(p_movement_type,'')));
  v_key text := trim(coalesce(p_idempotency_key,''));
  v_notes text := left(coalesce(p_notes,''),1000);
  v_qty numeric(14,3);
  v_cost numeric(14,2);
  v_item public.restaurant_inventory%rowtype;
  v_existing public.restaurant_inventory_movements%rowtype;
  v_movement_id uuid;
  v_new_stock numeric;
  v_new_cost numeric;
  v_scope_key text;
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;
  if p_inventory_id is null or length(trim(p_inventory_id)) = 0 then
    raise exception 'Inventory item required';
  end if;
  if v_type not in ('RECEIPT','ISSUE','OPENING_BALANCE') then
    raise exception 'Unsupported inventory movement type';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 1000000
     or p_quantity <> round(p_quantity,3) then
    raise exception 'Invalid inventory quantity';
  end if;
  if p_unit_cost_egp is null or p_unit_cost_egp < 0 or p_unit_cost_egp > 100000000
     or p_unit_cost_egp <> round(p_unit_cost_egp,2) then
    raise exception 'Invalid inventory unit cost';
  end if;
  if length(v_key) < 16 or length(v_key) > 128 then
    raise exception 'A valid idempotency key is required';
  end if;

  select i.* into v_item
  from public.restaurant_inventory i
  where i.id = p_inventory_id
  for update;

  if not found then
    raise exception 'Inventory item not found';
  end if;

  if not exists (
    select 1
    from public.user_memberships m
    where m.user_id = v_actor
      and m.status = 'ACTIVE'
      and m.tenant_id = v_item.tenant_id
      and m.business_id = v_item.business_id
      and m.branch_id = v_item.branch_id
      and upper(m.role) in (
        'OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF',
        'SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS'
      )
  ) then
    raise exception 'Active membership with inventory permission required';
  end if;

  v_cost := case when v_type = 'ISSUE' then v_item.unit_cost_egp else p_unit_cost_egp end;

  v_scope_key := v_item.tenant_id || ':' || v_item.business_id::text || ':' ||
                 v_item.branch_id || ':' || v_key;
  perform pg_advisory_xact_lock(hashtextextended(v_scope_key, 0));

  select mv.* into v_existing
  from public.restaurant_inventory_movements mv
  where mv.tenant_id = v_item.tenant_id
    and mv.business_id = v_item.business_id
    and mv.branch_id = v_item.branch_id
    and mv.idempotency_key = v_key;

  if found then
    if v_existing.inventory_id is distinct from v_item.id
       or v_existing.movement_type is distinct from v_type
       or v_existing.quantity is distinct from p_quantity
       or (v_type <> 'ISSUE' and v_existing.unit_cost_egp is distinct from v_cost)
       or v_existing.notes is distinct from v_notes
       or v_existing.created_by is distinct from v_actor then
      raise exception 'Idempotency key was already used for a different movement';
    end if;
    return jsonb_build_object(
      'movement_id', v_existing.id,
      'inventory_id', v_item.id,
      'movement_type', v_existing.movement_type,
      'quantity', v_existing.quantity,
      'current_stock_qty', v_item.current_stock_qty,
      'idempotent_replay', true
    );
  end if;

  if v_type = 'ISSUE' and v_item.current_stock_qty < p_quantity then
    raise exception 'Insufficient inventory stock';
  end if;
  if v_type = 'OPENING_BALANCE' and (
      v_item.current_stock_qty <> 0
      or exists (select 1 from public.restaurant_inventory_movements mv where mv.inventory_id = v_item.id)
      or not exists (
        select 1 from public.user_memberships m
        where m.user_id = v_actor and m.status = 'ACTIVE'
          and m.tenant_id = v_item.tenant_id
          and m.business_id = v_item.business_id
          and m.branch_id = v_item.branch_id
          and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','PROVIDER_OWNER','PROVIDER_ADMIN')
      )
    ) then
    raise exception 'Opening balance is allowed only once for an empty item by an authorized manager';
  end if;

  v_new_stock := case when v_type = 'ISSUE'
    then v_item.current_stock_qty - p_quantity
    else v_item.current_stock_qty + p_quantity end;

  if v_type = 'OPENING_BALANCE' then
    v_new_cost := v_cost;
  elsif v_type = 'RECEIPT' then
    v_new_cost := case when v_new_stock > 0
      then round(((v_item.current_stock_qty * v_item.unit_cost_egp) +
                  (p_quantity * v_cost)) / v_new_stock, 2)
      else p_unit_cost_egp end;
  else
    v_new_cost := v_item.unit_cost_egp;
  end if;

  insert into public.restaurant_inventory_movements (
    inventory_id, tenant_id, business_id, branch_id, movement_type,
    quantity, unit_cost_egp, idempotency_key, notes, created_by
  ) values (
    v_item.id, v_item.tenant_id, v_item.business_id, v_item.branch_id, v_type,
    p_quantity, v_cost, v_key, v_notes, v_actor
  ) returning id into v_movement_id;

  update public.restaurant_inventory
  set current_stock_qty = v_new_stock,
      unit_cost_egp = v_new_cost,
      updated_at = now()
  where id = v_item.id
    and tenant_id = v_item.tenant_id
    and business_id = v_item.business_id
    and branch_id = v_item.branch_id;

  if not found then
    raise exception 'Inventory scope changed during movement';
  end if;

  return jsonb_build_object(
    'movement_id', v_movement_id,
    'inventory_id', v_item.id,
    'movement_type', v_type,
    'quantity', p_quantity,
    'current_stock_qty', v_new_stock,
    'unit_cost_egp', v_new_cost,
    'idempotent_replay', false
  );
end;
$function$;

revoke all on function public.restaurant_inventory_move(text,text,numeric,numeric,text,text) from public, anon, authenticated;
grant execute on function public.restaurant_inventory_move(text,text,numeric,numeric,text,text) to authenticated;
