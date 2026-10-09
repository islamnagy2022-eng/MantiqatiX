-- Read-only production security inventory. Execute as a trusted database administrator.
-- This file does not change schema, grants, policies, or data.

-- 1) SECURITY DEFINER functions: pinned search_path and effective execute privileges.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as owner_name,
  p.prosecdef as security_definer,
  coalesce(p.proconfig::text,'') as function_settings,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','auth','storage')
  and p.prosecdef
order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid);

-- 2) Public tables: RLS state, FORCE RLS, and policy count.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  count(pol.policyname)::int as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
left join pg_policies pol on pol.schemaname=n.nspname and pol.tablename=c.relname
where n.nspname='public' and c.relkind in ('r','p')
group by n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
order by c.relrowsecurity,c.relname;

-- 3) Tables that appear to be missing RLS or policies. Review intentionally public lookup tables separately.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(pol.policyname)::int as policy_count
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
left join pg_policies pol on pol.schemaname=n.nspname and pol.tablename=c.relname
where n.nspname='public' and c.relkind in ('r','p')
group by n.nspname,c.relname,c.relrowsecurity
having not c.relrowsecurity or count(pol.policyname)=0
order by c.relname;

-- 4) Full policy expressions and role targets for tenant-scope review.
select
  schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where schemaname='public'
order by tablename,policyname;

-- 5) Direct table grants that may bypass intended Edge/RPC boundaries.
select grantee,table_schema,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('anon','authenticated','service_role')
  and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
order by table_name,grantee,privilege_type;

-- Interpretation:
-- - Any SECURITY DEFINER function with a mutable/unpinned search_path is a review finding.
-- - RLS disabled or zero-policy tables are not automatically vulnerabilities, but must be explicitly justified.
-- - Broad authenticated/service_role grants must be checked against the intended server-only mutation boundary.
-- - Do not auto-revoke or auto-enable RLS based on this report; assess dependencies and test in staging first.
