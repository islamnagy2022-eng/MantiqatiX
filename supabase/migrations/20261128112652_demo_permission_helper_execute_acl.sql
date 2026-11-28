BEGIN;

-- The clean Production checkpoint can have a narrower ACL than the current
-- DEMO database. Establish the intended helper contract before the immediately
-- following search_path migration asserts it. These helpers perform their own
-- tenant/permission checks; anonymous execution remains denied.
REVOKE ALL ON FUNCTION public.mnty_active_membership(character varying,uuid,character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnty_active_membership(character varying,uuid,character varying) TO authenticated;
REVOKE ALL ON FUNCTION public.mnty_can(text,character varying,uuid,character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnty_can(text,character varying,uuid,character varying) TO authenticated;

DO $demo_permission_helper_execute_acl$
BEGIN
  IF pg_catalog.has_function_privilege('anon','public.mnty_active_membership(character varying,uuid,character varying)','EXECUTE')
     OR pg_catalog.has_function_privilege('anon','public.mnty_can(text,character varying,uuid,character varying)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.mnty_active_membership(character varying,uuid,character varying)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.mnty_can(text,character varying,uuid,character varying)','EXECUTE') THEN
    RAISE EXCEPTION 'DEMO_PERMISSION_HELPER_EXECUTE_ACL_CONTRACT_FAILED';
  END IF;
END;
$demo_permission_helper_execute_acl$;

COMMIT;
