
-- MantiqaTix production security hardening
-- 1) Enable RLS on every currently exposed public table that lacked it.
alter table public.business_sectors enable row level security;
alter table public.business_categories enable row level security;
alter table public.modules enable row level security;
alter table public.tenant_modules enable row level security;
alter table public.business_modules enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.stock_balances enable row level security;
alter table public.order_status_history enable row level security;
alter table public.approval_actions enable row level security;
alter table public.chart_of_accounts enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commission_transactions enable row level security;
alter table public.ad_spaces enable row level security;
alter table public.advertisements enable row level security;
alter table public.general_ledger enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.settlement_transactions enable row level security;
alter table public.bookings enable row level security;

-- 2) Remove existing policies that accidentally apply to PUBLIC/anon and rebuild them for authenticated users.
drop policy if exists "p_insert_audit_logs" on public.audit_logs;
drop policy if exists "p_select_audit_logs" on public.audit_logs;
drop policy if exists "p_insert_sync_logs" on public.sync_logs;
drop policy if exists "p_select_sync_logs" on public.sync_logs;
drop policy if exists "Tenant admins can manage payment methods" on public.tenant_payment_methods;
drop policy if exists "Block tenant updates" on public.tenants;
drop policy if exists "Users can view own tenant" on public.tenants;
drop policy if exists "Users can view own memberships" on public.user_memberships;
drop policy if exists "Block direct insert businesses" on public.businesses;
drop policy if exists "Users can view tenant businesses" on public.businesses;
drop policy if exists "businesses_tenant_manage" on public.businesses;
drop policy if exists "businesses_tenant_read" on public.businesses;

create policy "audit_logs_select_tenant"
on public.audit_logs for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = audit_logs.tenant_id
    and um.status = 'ACTIVE'
));

create policy "audit_logs_insert_tenant"
on public.audit_logs for insert to authenticated
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = audit_logs.tenant_id
    and um.status = 'ACTIVE'
));

create policy "sync_logs_select_tenant"
on public.sync_logs for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = sync_logs.tenant_id
    and um.status = 'ACTIVE'
));

create policy "sync_logs_insert_tenant"
on public.sync_logs for insert to authenticated
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = sync_logs.tenant_id
    and um.status = 'ACTIVE'
));

create policy "tenant_payment_methods_manage"
on public.tenant_payment_methods for all to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = tenant_payment_methods.tenant_id
    and um.status = 'ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
))
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = tenant_payment_methods.tenant_id
    and um.status = 'ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "tenants_select_member"
on public.tenants for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = tenants.id
    and um.status = 'ACTIVE'
));

create policy "tenants_no_direct_update"
on public.tenants for update to authenticated using (false) with check (false);

create policy "memberships_select_self"
on public.user_memberships for select to authenticated
using ((select auth.uid()) = user_id);

-- Businesses: one SELECT policy and separate management policies to avoid permissive-policy overlap.
create policy "businesses_member_select"
on public.businesses for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = businesses.tenant_id
    and um.status = 'ACTIVE'
));

create policy "businesses_manager_insert"
on public.businesses for insert to authenticated
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = businesses.tenant_id
    and um.status = 'ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "businesses_manager_update"
on public.businesses for update to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = businesses.tenant_id
    and um.status = 'ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
))
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = businesses.tenant_id
    and um.status = 'ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "businesses_manager_delete"
on public.businesses for delete to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.tenant_id = businesses.tenant_id
    and um.status = 'ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

-- 3) Global reference data: authenticated read-only.
create policy "business_sectors_authenticated_read"
on public.business_sectors for select to authenticated using (true);

create policy "business_categories_authenticated_read"
on public.business_categories for select to authenticated using (true);

create policy "modules_authenticated_read"
on public.modules for select to authenticated using (true);

create policy "ad_spaces_authenticated_read"
on public.ad_spaces for select to authenticated using (true);

-- 4) Tenant-scoped operational data.
create policy "tenant_modules_member_read"
on public.tenant_modules for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE'
));

create policy "tenant_modules_admin_write"
on public.tenant_modules for all to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN')
))
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=tenant_modules.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN')
));

create policy "business_modules_member_read"
on public.business_modules for select to authenticated
using (exists (
  select 1 from public.businesses b
  join public.user_memberships um on um.tenant_id=b.tenant_id
  where b.id=business_modules.business_id
    and um.user_id=(select auth.uid()) and um.status='ACTIVE'
));

create policy "business_modules_manager_write"
on public.business_modules for all to authenticated
using (exists (
  select 1 from public.businesses b
  join public.user_memberships um on um.tenant_id=b.tenant_id
  where b.id=business_modules.business_id
    and um.user_id=(select auth.uid()) and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
))
with check (exists (
  select 1 from public.businesses b
  join public.user_memberships um on um.tenant_id=b.tenant_id
  where b.id=business_modules.business_id
    and um.user_id=(select auth.uid()) and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "warehouses_member_read"
on public.warehouses for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE'
));

create policy "warehouses_manager_write"
on public.warehouses for all to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
))
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=warehouses.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "inventory_transactions_member_read"
on public.inventory_transactions for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=inventory_transactions.tenant_id and um.status='ACTIVE'
));

create policy "inventory_transactions_manager_insert"
on public.inventory_transactions for insert to authenticated
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=inventory_transactions.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
) and created_by=(select auth.uid()));

create policy "stock_balances_member_read"
on public.stock_balances for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=stock_balances.tenant_id and um.status='ACTIVE'
));

create policy "order_status_history_member_read"
on public.order_status_history for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=order_status_history.tenant_id and um.status='ACTIVE'
));

create policy "order_status_history_manager_insert"
on public.order_status_history for insert to authenticated
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=order_status_history.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
) and changed_by=(select auth.uid()));

create policy "approval_actions_member_read"
on public.approval_actions for select to authenticated
using (exists (
  select 1 from public.approval_requests ar
  join public.user_memberships um on um.tenant_id=ar.tenant_id
  where ar.id=approval_actions.approval_request_id
    and um.user_id=(select auth.uid()) and um.status='ACTIVE'
));

create policy "approval_actions_member_insert"
on public.approval_actions for insert to authenticated
with check (acted_by=(select auth.uid()) and exists (
  select 1 from public.approval_requests ar
  join public.user_memberships um on um.tenant_id=ar.tenant_id
  where ar.id=approval_actions.approval_request_id
    and um.user_id=(select auth.uid()) and um.status='ACTIVE'
));

-- 5) Financial/ledger tables: fail closed for direct client writes; reads are tenant-scoped.
create policy "chart_of_accounts_member_read"
on public.chart_of_accounts for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=chart_of_accounts.tenant_id and um.status='ACTIVE'
));

create policy "journal_entry_lines_member_read"
on public.journal_entry_lines for select to authenticated
using (exists (
  select 1 from public.journal_entries je
  join public.user_memberships um on um.tenant_id=je.tenant_id
  where je.id=journal_entry_lines.journal_entry_id
    and um.user_id=(select auth.uid()) and um.status='ACTIVE'
));

create policy "commission_rules_member_read"
on public.commission_rules for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE'
));

create policy "commission_rules_admin_write"
on public.commission_rules for all to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
))
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=commission_rules.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "commission_transactions_member_read"
on public.commission_transactions for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=commission_transactions.tenant_id and um.status='ACTIVE'
));

create policy "advertisements_member_read"
on public.advertisements for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE'
));

create policy "advertisements_manager_write"
on public.advertisements for all to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
))
with check (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=advertisements.tenant_id and um.status='ACTIVE'
    and um.role in ('OWNER','ADMIN','MANAGER')
));

create policy "general_ledger_member_read"
on public.general_ledger for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=general_ledger.tenant_id and um.status='ACTIVE'
));

create policy "wallet_accounts_member_read"
on public.wallet_accounts for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=wallet_accounts.tenant_id and um.status='ACTIVE'
));

create policy "wallet_transactions_member_read"
on public.wallet_transactions for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=wallet_transactions.tenant_id and um.status='ACTIVE'
));

create policy "settlement_transactions_member_read"
on public.settlement_transactions for select to authenticated
using (exists (
  select 1 from public.user_memberships um
  where um.user_id=(select auth.uid()) and um.tenant_id=settlement_transactions.tenant_id and um.status='ACTIVE'
));

-- bookings has no tenant/user ownership columns; keep it fail-closed until its data model is connected to the tenant model.

-- 6) Replace broken/over-privileged helper functions with safe authenticated-only versions.
create or replace function public.current_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select auth.uid();
$function$;

create or replace function public.current_tenant_id()
returns varchar
language sql
stable
security invoker
set search_path = ''
as $function$
  select um.tenant_id
  from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.status = 'ACTIVE'
  order by um.created_at asc
  limit 1;
$function$;

create or replace function public.current_business_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $function$
  select um.business_id
  from public.user_memberships um
  where um.user_id = (select auth.uid())
    and um.status = 'ACTIVE'
    and um.business_id is not null
  order by um.created_at asc
  limit 1;
$function$;

revoke execute on function public.current_user_id() from public, anon;
revoke execute on function public.current_tenant_id() from public, anon;
revoke execute on function public.current_business_id() from public, anon;
grant execute on function public.current_user_id() to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.current_business_id() to authenticated;

-- 7) Pin search_path on existing functions flagged by the security advisor.
alter function public.validate_journal_entry_balance() set search_path = 'public';
alter function public.trg_enforce_journal_entry_immutability() set search_path = 'public';
alter function public.trg_enforce_journal_line_immutability() set search_path = 'public';
alter function public.trg_validate_journal_entry_balance() set search_path = 'public';
alter function public.trg_post_journal_to_general_ledger() set search_path = 'public';
alter function public.trg_enforce_wallet_balance_integrity() set search_path = 'public';
alter function public.reverse_journal_entry(varchar,text,varchar) set search_path = 'public';
alter function public.set_updated_at() set search_path = 'public';

-- 8) Make the payment-method view obey underlying RLS on PostgreSQL 15+.
create or replace view public.available_payment_methods
with (security_invoker = true)
as
select id, tenant_id, payment_method, provider, public_config
from public.tenant_payment_methods
where is_enabled = true
  and exists (
    select 1
    from public.user_memberships um
    where um.user_id = (select auth.uid())
      and um.tenant_id = public.tenant_payment_methods.tenant_id
      and um.status = 'ACTIVE'
  );

-- 9) Remove the duplicate branch index.
drop index if exists public.idx_branches_biz;

-- 10) Add tenant indexes used by the new RLS predicates.
create index if not exists idx_business_sectors_code on public.business_sectors(code);
create index if not exists idx_business_categories_sector_id on public.business_categories(sector_id);
create index if not exists idx_tenant_modules_tenant_id on public.tenant_modules(tenant_id);
create index if not exists idx_business_modules_business_id on public.business_modules(business_id);
create index if not exists idx_warehouses_tenant_id on public.warehouses(tenant_id);
create index if not exists idx_inventory_transactions_tenant_id on public.inventory_transactions(tenant_id);
create index if not exists idx_stock_balances_tenant_id on public.stock_balances(tenant_id);
create index if not exists idx_order_status_history_tenant_id on public.order_status_history(tenant_id);
create index if not exists idx_approval_actions_request_id on public.approval_actions(approval_request_id);
create index if not exists idx_chart_of_accounts_tenant_id on public.chart_of_accounts(tenant_id);
create index if not exists idx_journal_entry_lines_entry_id on public.journal_entry_lines(journal_entry_id);
create index if not exists idx_commission_rules_tenant_id on public.commission_rules(tenant_id);
create index if not exists idx_commission_transactions_tenant_id on public.commission_transactions(tenant_id);
create index if not exists idx_advertisements_tenant_id on public.advertisements(tenant_id);
create index if not exists idx_general_ledger_tenant_id on public.general_ledger(tenant_id);
create index if not exists idx_wallet_accounts_tenant_id on public.wallet_accounts(tenant_id);
create index if not exists idx_wallet_transactions_tenant_id on public.wallet_transactions(tenant_id);
create index if not exists idx_settlement_transactions_tenant_id on public.settlement_transactions(tenant_id);

-- 11) New public objects should not be exposed by default.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;
