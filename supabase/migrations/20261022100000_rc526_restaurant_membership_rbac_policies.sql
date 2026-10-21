-- RC526: Align restaurant table RLS with the shared workspace RBAC roles.
-- Existing restrictive tenant/business/branch and authenticated-session policies remain in force.
-- These permissive policies only grant the role-specific operation inside the exact active membership scope.

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
