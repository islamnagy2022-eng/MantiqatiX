-- RC441 platform-admin authorization verification. READ ONLY; no DDL/DML.
-- Run after the approved RC441 migration in the intended Supabase project.

-- 1) Confirm the platform guard uses explicit role/scope/full-control predicates.
select
  p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  coalesce(p.proconfig::text,'') as function_settings,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  position('SUPER_ADMIN' in pg_get_functiondef(p.oid)) > 0 as requires_super_admin,
  position('PLATFORM' in pg_get_functiondef(p.oid)) > 0 as checks_platform_scope,
  position('full_control' in pg_get_functiondef(p.oid)) > 0 as checks_full_control
from pg_catalog.pg_proc p
where p.oid = to_regprocedure('public.mnty_can_platform_admin()');

-- 2) Verify platform-wide operations are guarded and use a hardened search_path.
select
  p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  coalesce(p.proconfig::text,'') as function_settings,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  position('mnty_can_platform_admin' in pg_get_functiondef(p.oid)) > 0 as checks_platform_admin
from pg_catalog.pg_proc p
where p.oid in (
  to_regprocedure('public.get_mantigo_admin_dashboard_backend(uuid)'),
  to_regprocedure('public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)'),
  to_regprocedure('public.settle_mantigo_captain_backend(uuid,text,text)'),
  to_regprocedure('public.expire_stale_mantigo_rides_backend(uuid,integer)')
)
order by p.oid::regprocedure::text;

-- 3) Inventory other authenticated SECURITY DEFINER functions for review; do not revoke in bulk.
select
  p.oid::regprocedure as function_signature,
  coalesce(p.proconfig::text,'') as function_settings,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and has_function_privilege('authenticated',p.oid,'EXECUTE')
order by p.proname, p.oid::regprocedure::text;

-- Expected after RC441:
-- * mnty_can_platform_admin: requires SUPER_ADMIN + PLATFORM scope + full_control.
-- * The four platform-wide MantiGO operations above: checks_platform_admin=true.
-- * No anon execution on the guard or these four operations.
-- A false/empty row is not proof of safety; inspect the exact function definition and effective grants.
