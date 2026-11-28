BEGIN;

-- These legacy permission helpers already use fully qualified object names.
-- Empty search_path removes public/pg_temp name-resolution risk without
-- changing auth.uid(), tenant membership, or permission semantics.
ALTER FUNCTION public.mnty_active_membership(character varying,uuid,character varying)
  SET search_path = '';
ALTER FUNCTION public.mnty_can(text,character varying,uuid,character varying)
  SET search_path = '';

DO $demo_permission_helper_search_path_contract$
DECLARE
  v_active oid := pg_catalog.to_regprocedure('public.mnty_active_membership(character varying,uuid,character varying)');
  v_can oid := pg_catalog.to_regprocedure('public.mnty_can(text,character varying,uuid,character varying)');
  v_active_config text[];
  v_can_config text[];
BEGIN
  IF v_active IS NULL OR v_can IS NULL THEN
    RAISE EXCEPTION 'DEMO_PERMISSION_HELPER_FUNCTION_MISSING';
  END IF;

  SELECT p.proconfig INTO v_active_config FROM pg_catalog.pg_proc p WHERE p.oid=v_active;
  SELECT p.proconfig INTO v_can_config FROM pg_catalog.pg_proc p WHERE p.oid=v_can;

  IF NOT coalesce(v_active_config,ARRAY[]::text[]) @> ARRAY['search_path=""']::text[]
     OR NOT coalesce(v_can_config,ARRAY[]::text[]) @> ARRAY['search_path=""']::text[] THEN
    RAISE EXCEPTION 'DEMO_PERMISSION_HELPER_EMPTY_SEARCH_PATH_FAILED';
  END IF;

  IF pg_catalog.has_function_privilege('anon',v_active,'EXECUTE')
     OR pg_catalog.has_function_privilege('anon',v_can,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated',v_active,'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated',v_can,'EXECUTE') THEN
    RAISE EXCEPTION 'DEMO_PERMISSION_HELPER_EXECUTE_ACL_CHANGED';
  END IF;
END;
$demo_permission_helper_search_path_contract$;

COMMIT;
