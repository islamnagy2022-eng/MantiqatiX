-- Keep tenant scope and creator ownership immutable during ordinary row updates.
-- Role-based membership policies must not allow a client to move a row to another branch.
create or replace function public.guard_restaurant_row_scope()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if not public.is_platform_admin() and (
    new.owner_user_id is distinct from old.owner_user_id
    or new.tenant_id is distinct from old.tenant_id
    or new.business_id is distinct from old.business_id
    or new.branch_id is distinct from old.branch_id
  ) then
    raise exception 'Restaurant row ownership and scope are immutable';
  end if;
  return new;
end;
$function$;

revoke execute on function public.guard_restaurant_row_scope() from public, anon, authenticated;

drop trigger if exists restaurant_menu_items_scope_immutable on public.restaurant_menu_items;
create trigger restaurant_menu_items_scope_immutable
before update on public.restaurant_menu_items
for each row execute function public.guard_restaurant_row_scope();

drop trigger if exists restaurant_tables_scope_immutable on public.restaurant_tables;
create trigger restaurant_tables_scope_immutable
before update on public.restaurant_tables
for each row execute function public.guard_restaurant_row_scope();

drop trigger if exists restaurant_inventory_scope_immutable on public.restaurant_inventory;
create trigger restaurant_inventory_scope_immutable
before update on public.restaurant_inventory
for each row execute function public.guard_restaurant_row_scope();

-- RC526: Align restaurant table RLS with the shared workspace RBAC roles.
-- Existing restrictive tenant/business/branch and authenticated-session policies remain in force.
-- These permissive policies only grant the role-specific operation inside the exact active membership scope.

-- Do not let a generic platform-admin helper bypass branch isolation for these workspaces.
-- The workspace always operates under an explicitly selected active membership.
drop policy if exists legacy_scope_boundary on public.restaurant_menu_items;
create policy legacy_scope_boundary
on public.restaurant_menu_items
as restrictive
for all
to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_menu_items.tenant_id
      and m.business_id = restaurant_menu_items.business_id
      and m.branch_id = restaurant_menu_items.branch_id
  )
)
with check (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_menu_items.tenant_id
      and m.business_id = restaurant_menu_items.business_id
      and m.branch_id = restaurant_menu_items.branch_id
  )
);

drop policy if exists legacy_scope_boundary on public.restaurant_tables;
create policy legacy_scope_boundary
on public.restaurant_tables
as restrictive
for all
to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_tables.tenant_id
      and m.business_id = restaurant_tables.business_id
      and m.branch_id = restaurant_tables.branch_id
  )
)
with check (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_tables.tenant_id
      and m.business_id = restaurant_tables.business_id
      and m.branch_id = restaurant_tables.branch_id
  )
);

drop policy if exists legacy_scope_boundary on public.restaurant_inventory;
create policy legacy_scope_boundary
on public.restaurant_inventory
as restrictive
for all
to authenticated
using (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory.tenant_id
      and m.business_id = restaurant_inventory.business_id
      and m.branch_id = restaurant_inventory.branch_id
  )
)
with check (
  exists (
    select 1 from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory.tenant_id
      and m.business_id = restaurant_inventory.business_id
      and m.branch_id = restaurant_inventory.branch_id
  )
);

create policy restaurant_menu_items_membership_select
on public.restaurant_menu_items
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_menu_items.tenant_id
      and m.business_id = restaurant_menu_items.business_id
      and m.branch_id = restaurant_menu_items.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN')
  )
);

create policy restaurant_menu_items_membership_insert
on public.restaurant_menu_items
as permissive
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_menu_items.tenant_id
      and m.business_id = restaurant_menu_items.business_id
      and m.branch_id = restaurant_menu_items.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','PROVIDER_OWNER','PROVIDER_ADMIN')
  )
);

create policy restaurant_menu_items_membership_update
on public.restaurant_menu_items
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_menu_items.tenant_id
      and m.business_id = restaurant_menu_items.business_id
      and m.branch_id = restaurant_menu_items.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN')
  )
)
with check (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_menu_items.tenant_id
      and m.business_id = restaurant_menu_items.business_id
      and m.branch_id = restaurant_menu_items.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN')
  )
);

create policy restaurant_tables_membership_select
on public.restaurant_tables
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_tables.tenant_id
      and m.business_id = restaurant_tables.business_id
      and m.branch_id = restaurant_tables.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
);

create policy restaurant_tables_membership_insert
on public.restaurant_tables
as permissive
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_tables.tenant_id
      and m.business_id = restaurant_tables.business_id
      and m.branch_id = restaurant_tables.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
);

create policy restaurant_tables_membership_update
on public.restaurant_tables
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_tables.tenant_id
      and m.business_id = restaurant_tables.business_id
      and m.branch_id = restaurant_tables.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
)
with check (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_tables.tenant_id
      and m.business_id = restaurant_tables.business_id
      and m.branch_id = restaurant_tables.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
);

create policy restaurant_inventory_membership_select
on public.restaurant_inventory
as permissive
for select
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory.tenant_id
      and m.business_id = restaurant_inventory.business_id
      and m.branch_id = restaurant_inventory.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
);

create policy restaurant_inventory_membership_insert
on public.restaurant_inventory
as permissive
for insert
to authenticated
with check (
  owner_user_id = (select auth.uid())
  and exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory.tenant_id
      and m.business_id = restaurant_inventory.business_id
      and m.branch_id = restaurant_inventory.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
);

create policy restaurant_inventory_membership_update
on public.restaurant_inventory
as permissive
for update
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory.tenant_id
      and m.business_id = restaurant_inventory.business_id
      and m.branch_id = restaurant_inventory.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
)
with check (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = (select auth.uid())
      and m.status = 'ACTIVE'
      and m.tenant_id = restaurant_inventory.tenant_id
      and m.business_id = restaurant_inventory.business_id
      and m.branch_id = restaurant_inventory.branch_id
      and upper(m.role) in ('OWNER','ADMIN','BUSINESS_OWNER','MANAGER','EMPLOYEE','STAFF','SERVICE_PROVIDER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')
  )
);
