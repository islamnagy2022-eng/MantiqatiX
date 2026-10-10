-- RC440 verification only; read-only, safe to run before and after the migration.
select
  p.oid::regprocedure as function_signature,
  p.prosecdef as security_definer,
  coalesce(p.proconfig::text,'') as function_settings,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
order by function_signature;

-- Acceptance: zero exposed SECURITY DEFINER functions should remain with exactly search_path=public.
select count(*)::integer as exposed_security_definer_with_unsafe_public_only_path
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef
  and exists(select 1 from pg_catalog.unnest(p.proconfig) cfg where cfg='search_path=public')
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));

-- Review the resulting paths. RC440 should affect only public-callable functions with the old exact setting.
select p.oid::regprocedure as function_signature, p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and exists(select 1 from pg_catalog.unnest(p.proconfig) cfg where cfg like 'search_path=public, pg_temp%')
  and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))
order by function_signature;
