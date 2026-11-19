-- RC484: replace the generic tenant-role global bypass with the protected platform-root registry.
-- All dependent RLS policies and SECURITY DEFINER callers inherit this stricter root predicate.
-- Tenant-local ownership/membership predicates remain unchanged.
BEGIN;

DO $preflight$
DECLARE
  v_registry_owner oid;
  v_helper_owner oid;
  v_registry_rls boolean;
  v_registry_force_rls boolean;
  v_policy_count integer;
  v_policy_table_count integer;
BEGIN
  IF pg_catalog.to_regclass('private.platform_admins') IS NULL THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_MISSING';
  END IF;

  SELECT c.relowner,c.relrowsecurity,c.relforcerowsecurity
    INTO v_registry_owner,v_registry_rls,v_registry_force_rls
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='private' AND c.relname='platform_admins';

  IF NOT coalesce(v_registry_rls,false) THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_RLS_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid=pg_catalog.to_regclass('private.platform_admins')
      AND attname='user_id' AND atttypid='uuid'::pg_catalog.regtype
      AND attnum>0 AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_USER_ID_UUID_REQUIRED';
  END IF;

  IF pg_catalog.has_table_privilege('anon','private.platform_admins','SELECT')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','SELECT')
     OR pg_catalog.has_table_privilege('anon','private.platform_admins','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','INSERT')
     OR pg_catalog.has_table_privilege('anon','private.platform_admins','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','UPDATE')
     OR pg_catalog.has_table_privilege('anon','private.platform_admins','DELETE')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','DELETE') THEN
    RAISE EXCEPTION 'RC484_PLATFORM_ADMIN_REGISTRY_CLIENT_TABLE_PRIVILEGE_FOUND';
  END IF;

  IF pg_catalog.to_regprocedure('public.is_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'RC484_IS_PLATFORM_ADMIN_HELPER_MISSING';
  END IF;

  SELECT p.proowner INTO v_helper_owner
  FROM pg_catalog.pg_proc p
  WHERE p.oid=pg_catalog.to_regprocedure('public.is_platform_admin()');

  IF v_helper_owner IS DISTINCT FROM v_registry_owner
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_roles r
       WHERE r.oid=v_helper_owner AND r.rolbypassrls
     ) THEN
    RAISE EXCEPTION 'RC484_HELPER_OWNER_MUST_MATCH_BYPASS_RLS_REGISTRY_OWNER';
  END IF;

  SELECT count(*),count(DISTINCT schemaname||'.'||tablename)
    INTO v_policy_count,v_policy_table_count
  FROM pg_catalog.pg_policies
  WHERE coalesce(qual,'') ILIKE '%is_platform_admin()%'
     OR coalesce(with_check,'') ILIKE '%is_platform_admin()%';

  IF v_policy_count<57 OR v_policy_table_count<24 THEN
    RAISE EXCEPTION 'RC484_RLS_POLICY_BLAST_RADIUS_DRIFT: expected at least 57 policies across 24 tables; found % across %',
      v_policy_count,v_policy_table_count;
  END IF;
END;
$preflight$;

-- The canonical registry is locked under FORCE RLS before the helper is replaced.
-- The helper owner is checked above to be the registry owner with BYPASSRLS, so
-- the SECURITY DEFINER lookup remains functional without granting client access.
-- Empty search_path prevents
-- object-shadowing; every referenced object is schema-qualified.
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins pa
    WHERE pa.user_id=(SELECT auth.uid())
  )
$function$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'RC484: platform-root authority only; backed exclusively by private.platform_admins. Tenant ADMIN/SUPER_ADMIN membership does not grant global RLS or SECURITY DEFINER bypass.';

COMMIT;
