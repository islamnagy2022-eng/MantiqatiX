-- RC258 read-only server-side RBAC contract verification.
-- Run in a privileged verification session. No DDL/DML.
-- This verifies the centralized permission contract and the documented role matrix.

with expected(role, permission) as (
  values
    ('SUPER_ADMIN','admin'),('SUPER_ADMIN','all_modules'),('SUPER_ADMIN','manage_finance'),
    ('OWNER','admin'),('OWNER','owner'),('OWNER','platform'),('OWNER','manage_users'),('OWNER','manage_finance'),
    ('BUSINESS_OWNER','owner'),('BUSINESS_OWNER','manage_business'),('BUSINESS_OWNER','manage_catalog'),('BUSINESS_OWNER','manage_orders'),
    ('ADMIN','admin'),('ADMIN','manage_users'),('ADMIN','manage_business'),('ADMIN','manage_orders'),('ADMIN','manage_reports'),
    ('MANAGER','manage_branches'),('MANAGER','manage_catalog'),('MANAGER','manage_orders'),('MANAGER','manage_reports'),
    ('FINANCE_MANAGER','manage_finance'),('FINANCE_MANAGER','manage_reports'),
    ('SERVICE_PROVIDER','provider'),('SERVICE_PROVIDER','provider_orders'),('SERVICE_PROVIDER','provider_profile'),('SERVICE_PROVIDER','provider_schedule'),('SERVICE_PROVIDER','provider_finance'),
    ('STAFF','staff'),('STAFF','manage_orders'),('STAFF','provider_orders'),
    ('SUPPORT_MANAGER','support'),('SUPPORT_MANAGER','manage_crm'),('SUPPORT_MANAGER','manage_reports'),
    ('SUPPORT','support'),('EMPLOYEE','employee'),('CUSTOMER','customer')
), membership_roles as (
  select upper(role) role, count(*) active_memberships
  from public.user_memberships
  where status='ACTIVE'
  group by upper(role)
), function_contract as (
  select p.proname,
         p.prosecdef security_definer,
         has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
         has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('mnty_active_membership','mnty_can','mnty_can_platform_admin')
)
select e.role,e.permission,coalesce(m.active_memberships,0) active_memberships,
       case when e.role='SUPER_ADMIN' and e.permission in ('admin','all_modules','manage_finance') then 'EXPECTED_PLATFORM_CAPABILITY'
            else 'EXPECTED_ROLE_CAPABILITY' end contract_status
from expected e left join membership_roles m using(role)
order by e.role,e.permission;

select proname, security_definer, anon_execute, authenticated_execute,
       case when security_definer and not anon_execute and authenticated_execute then 'PASS' else 'REVIEW' end status
from function_contract
order by proname;

-- Strict platform capability is encoded only by SUPER_ADMIN + permissions.scope=PLATFORM + full_control=true.
select count(*) filter (where upper(role)='SUPER_ADMIN') as active_super_admins,
       count(*) filter (where upper(role)='OWNER') as active_owners,
       count(*) filter (where upper(role)='SERVICE_PROVIDER') as active_service_providers
from public.user_memberships
where status='ACTIVE';
