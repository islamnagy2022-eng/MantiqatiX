-- RC501: pin the seven remaining SECURITY DEFINER callers of
-- public.is_platform_admin() to an empty search_path.
-- The function bodies, owners, ACLs, signatures and authorization logic are preserved.
-- Requires RC484's registry-backed public.is_platform_admin() helper.
BEGIN;

DO $preflight$
DECLARE
  v_helper_oid oid;
  v_helper_owner oid;
  v_helper_src text;
  v_helper_config text[];
  v_registry_owner oid;
  v_count integer;
BEGIN
  v_helper_oid := pg_catalog.to_regprocedure('public.is_platform_admin()');
  IF v_helper_oid IS NULL THEN
    RAISE EXCEPTION 'RC501_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_MISSING';
  END IF;

  SELECT p.proowner, p.prosrc, p.proconfig
    INTO v_helper_owner, v_helper_src, v_helper_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid = v_helper_oid
    AND p.prosecdef;

  IF NOT FOUND
     OR v_helper_config IS DISTINCT FROM ARRAY['search_path=""']::text[]
     OR v_helper_src NOT ILIKE '%FROM private.platform_admins%'
     OR v_helper_src ILIKE '%FROM public.user_memberships%' THEN
    RAISE EXCEPTION 'RC501_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_NOT_HARDENED';
  END IF;

  SELECT c.relowner INTO v_registry_owner
  FROM pg_catalog.pg_class c
  WHERE c.oid = pg_catalog.to_regclass('private.platform_admins')
    AND c.relrowsecurity
    AND c.relforcerowsecurity;

  IF NOT FOUND OR v_registry_owner IS DISTINCT FROM v_helper_owner THEN
    RAISE EXCEPTION 'RC501_PLATFORM_ADMIN_REGISTRY_OWNER_OR_FORCE_RLS_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.oid = v_registry_owner AND r.rolbypassrls
  ) THEN
    RAISE EXCEPTION 'RC501_PLATFORM_ADMIN_REGISTRY_OWNER_MUST_BYPASS_RLS';
  END IF;

  IF pg_catalog.has_table_privilege('anon','private.platform_admins','SELECT')
     OR pg_catalog.has_table_privilege('authenticated','private.platform_admins','SELECT') THEN
    RAISE EXCEPTION 'RC501_PLATFORM_ADMIN_REGISTRY_CLIENT_SELECT_EXPOSED';
  END IF;

  IF pg_catalog.has_function_privilege('anon',v_helper_oid,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated',v_helper_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'RC501_PLATFORM_ADMIN_HELPER_ACL_INVALID';
  END IF;

  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.oid IN (
      pg_catalog.to_regprocedure('public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)'),
      pg_catalog.to_regprocedure('public.deactivate_business(uuid,text)'),
      pg_catalog.to_regprocedure('public.fashion_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.resolve_legacy_scope(text)'),
      pg_catalog.to_regprocedure('public.restaurant_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.restaurant_table_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)')
    )
    AND p.prosecdef
    AND p.proowner = v_helper_owner
    AND p.proconfig IS NOT DISTINCT FROM ARRAY['search_path=public']::text[]
    AND p.prosrc ILIKE '%public.is_platform_admin()%';

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'RC501_EXPECTS_SEVEN_EXACT_REGISTRY_HELPER_CALLERS: found %', v_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc p
    WHERE p.oid IN (
      pg_catalog.to_regprocedure('public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)'),
      pg_catalog.to_regprocedure('public.deactivate_business(uuid,text)'),
      pg_catalog.to_regprocedure('public.fashion_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.resolve_legacy_scope(text)'),
      pg_catalog.to_regprocedure('public.restaurant_erp_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.restaurant_table_mutate(text,jsonb,text)'),
      pg_catalog.to_regprocedure('public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)')
    )
    AND (
      pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
    )
  ) THEN
    RAISE EXCEPTION 'RC501_UNEXPECTED_DIRECT_CLIENT_OR_SERVICE_EXECUTE_GRANT';
  END IF;
END;
$preflight$;

-- Snapshot the exact function contract so the only permitted postcondition
-- change is search_path=public -> search_path="".
CREATE TEMP TABLE rc501_caller_before ON COMMIT DROP AS
SELECT p.oid,
       p.prosrc,
       p.proacl,
       p.proowner,
       p.prosecdef,
       p.proargtypes,
       p.prorettype,
       p.prolang,
       p.provolatile,
       p.proparallel,
       p.proisstrict,
       p.proretset,
       p.proleakproof,
       p.proconfig
FROM pg_catalog.pg_proc p
WHERE p.oid IN (
  pg_catalog.to_regprocedure('public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)'),
  pg_catalog.to_regprocedure('public.deactivate_business(uuid,text)'),
  pg_catalog.to_regprocedure('public.fashion_erp_mutate(text,jsonb,text)'),
  pg_catalog.to_regprocedure('public.resolve_legacy_scope(text)'),
  pg_catalog.to_regprocedure('public.restaurant_erp_mutate(text,jsonb,text)'),
  pg_catalog.to_regprocedure('public.restaurant_table_mutate(text,jsonb,text)'),
  pg_catalog.to_regprocedure('public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)')
);

DO $snapshot_guard$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_temp.rc501_caller_before;
  IF v_count <> 7 THEN
    RAISE EXCEPTION 'RC501_FUNCTION_SNAPSHOT_INCOMPLETE: expected 7, found %',v_count;
  END IF;
END;
$snapshot_guard$;

ALTER FUNCTION public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)
  SET search_path TO '';
ALTER FUNCTION public.deactivate_business(uuid,text)
  SET search_path TO '';
ALTER FUNCTION public.fashion_erp_mutate(text,jsonb,text)
  SET search_path TO '';
ALTER FUNCTION public.resolve_legacy_scope(text)
  SET search_path TO '';
ALTER FUNCTION public.restaurant_erp_mutate(text,jsonb,text)
  SET search_path TO '';
ALTER FUNCTION public.restaurant_table_mutate(text,jsonb,text)
  SET search_path TO '';
ALTER FUNCTION public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)
  SET search_path TO '';

DO $postcondition$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_temp.rc501_caller_before s
  JOIN pg_catalog.pg_proc p ON p.oid = s.oid
  WHERE p.proconfig IS NOT DISTINCT FROM pg_catalog.array_replace(
          s.proconfig,'search_path=public','search_path=""'
        )
    AND p.prosrc IS NOT DISTINCT FROM s.prosrc
    AND p.proacl IS NOT DISTINCT FROM s.proacl
    AND p.proowner IS NOT DISTINCT FROM s.proowner
    AND p.prosecdef IS NOT DISTINCT FROM s.prosecdef
    AND p.proargtypes IS NOT DISTINCT FROM s.proargtypes
    AND p.prorettype IS NOT DISTINCT FROM s.prorettype
    AND p.prolang IS NOT DISTINCT FROM s.prolang
    AND p.provolatile IS NOT DISTINCT FROM s.provolatile
    AND p.proparallel IS NOT DISTINCT FROM s.proparallel
    AND p.proisstrict IS NOT DISTINCT FROM s.proisstrict
    AND p.proretset IS NOT DISTINCT FROM s.proretset
    AND p.proleakproof IS NOT DISTINCT FROM s.proleakproof
    AND p.proconfig @> ARRAY['search_path=""']::text[];

  IF v_count <> 7 THEN
    RAISE EXCEPTION 'RC501_CALLER_CONTRACT_CHANGED_OR_SEARCH_PATH_POSTCONDITION_FAILED: expected 7, found %',v_count;
  END IF;
END;
$postcondition$;

COMMIT;
