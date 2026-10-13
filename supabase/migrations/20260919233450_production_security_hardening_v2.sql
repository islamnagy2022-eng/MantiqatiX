
create policy "approval_requests_member_read" on public.approval_requests
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=approval_requests.tenant_id and um.status='ACTIVE'));
create policy "approval_requests_member_insert" on public.approval_requests
for insert to authenticated with check (requested_by=(select auth.uid()) and exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=approval_requests.tenant_id and um.status='ACTIVE'));
create policy "approval_requests_manager_update" on public.approval_requests
for update to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=approval_requests.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=approval_requests.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

create policy "branches_member_read" on public.branches
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=branches.tenant_id and um.status='ACTIVE'));
create policy "branches_manager_write" on public.branches
for all to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=branches.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=branches.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

create policy "departments_member_read" on public.departments
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=departments.tenant_id and um.status='ACTIVE'));
create policy "departments_manager_write" on public.departments
for all to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=departments.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=departments.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

create policy "organizations_member_read" on public.organizations
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=organizations.tenant_id and um.status='ACTIVE'));
create policy "organizations_admin_write" on public.organizations
for all to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=organizations.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=organizations.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN')));

create policy "journal_entries_member_read" on public.journal_entries
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=journal_entries.tenant_id and um.status='ACTIVE'));
create policy "journal_entries_manager_insert" on public.journal_entries
for insert to authenticated with check (created_by=(select auth.uid()) and exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=journal_entries.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "journal_entries_manager_update" on public.journal_entries
for update to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=journal_entries.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=journal_entries.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

create policy "payment_events_member_read" on public.payment_events
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=payment_events.tenant_id and um.status='ACTIVE'));

create policy "payment_intents_member_read" on public.payment_intents
for select to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=payment_intents.tenant_id and um.status='ACTIVE'));

-- Rebuild payment methods view with invoker security (Postgres 15+).
drop view if exists public.available_payment_methods;
create view public.available_payment_methods with (security_invoker=true) as
select id, tenant_id, payment_method, provider, public_config
from public.tenant_payment_methods
where is_enabled=true
and exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=tenant_payment_methods.tenant_id and um.status='ACTIVE');

-- Consolidate overlapping SELECT policies by making write policies command-specific.
drop policy if exists "advertisements_manager_write" on public.advertisements;
create policy "advertisements_manager_insert" on public.advertisements for insert to authenticated with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "advertisements_manager_update" on public.advertisements for update to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "advertisements_manager_delete" on public.advertisements for delete to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

drop policy if exists "business_modules_manager_write" on public.business_modules;
create policy "business_modules_manager_insert" on public.business_modules for insert to authenticated with check (exists(select 1 from public.businesses b join public.user_memberships um on um.tenant_id=b.tenant_id where b.id=business_modules.business_id and um.user_id=(select auth.uid()) and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "business_modules_manager_update" on public.business_modules for update to authenticated using (exists(select 1 from public.businesses b join public.user_memberships um on um.tenant_id=b.tenant_id where b.id=business_modules.business_id and um.user_id=(select auth.uid()) and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.businesses b join public.user_memberships um on um.tenant_id=b.tenant_id where b.id=business_modules.business_id and um.user_id=(select auth.uid()) and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "business_modules_manager_delete" on public.business_modules for delete to authenticated using (exists(select 1 from public.businesses b join public.user_memberships um on um.tenant_id=b.tenant_id where b.id=business_modules.business_id and um.user_id=(select auth.uid()) and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

drop policy if exists "commission_rules_admin_write" on public.commission_rules;
create policy "commission_rules_admin_insert" on public.commission_rules for insert to authenticated with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "commission_rules_admin_update" on public.commission_rules for update to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "commission_rules_admin_delete" on public.commission_rules for delete to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

drop policy if exists "tenant_modules_admin_write" on public.tenant_modules;
create policy "tenant_modules_admin_insert" on public.tenant_modules for insert to authenticated with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN')));
create policy "tenant_modules_admin_update" on public.tenant_modules for update to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN')));
create policy "tenant_modules_admin_delete" on public.tenant_modules for delete to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN')));

drop policy if exists "warehouses_manager_write" on public.warehouses;
create policy "warehouses_manager_insert" on public.warehouses for insert to authenticated with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "warehouses_manager_update" on public.warehouses for update to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER'))) with check (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));
create policy "warehouses_manager_delete" on public.warehouses for delete to authenticated using (exists(select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE' and um.role in ('OWNER','ADMIN','MANAGER')));

drop index if exists public.idx_journal_entry_lines_entry_id;
