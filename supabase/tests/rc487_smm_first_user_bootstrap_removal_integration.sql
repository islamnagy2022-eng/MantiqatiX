-- RC487 post-migration contract. Disposable replay only.
DO $rc487$
DECLARE
  v_function oid := pg_catalog.to_regprocedure('public.smm_bootstrap_first_admin()');
  v_trigger_count integer;
  v_table_exists boolean;
BEGIN
  SELECT pg_catalog.to_regclass('public.smm_admins') IS NOT NULL
    INTO v_table_exists;
  IF v_table_exists IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RC487_SMM_ADMIN_ALLOWLIST_TABLE_MISSING';
  END IF;

  IF v_function IS NOT NULL THEN
    RAISE EXCEPTION 'RC487_FIRST_USER_BOOTSTRAP_FUNCTION_STILL_EXISTS';
  END IF;

  SELECT count(*) INTO v_trigger_count
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='auth'
     AND c.relname='users'
     AND NOT t.tgisinternal
     AND t.tgname='trg_smm_bootstrap_admin';

  IF v_trigger_count <> 0 THEN
    RAISE EXCEPTION 'RC487_FIRST_USER_BOOTSTRAP_TRIGGER_STILL_EXISTS';
  END IF;

  IF has_table_privilege('anon','public.smm_admins','SELECT')
     OR has_table_privilege('authenticated','public.smm_admins','SELECT')
     OR has_table_privilege('anon','public.smm_admins','INSERT')
     OR has_table_privilege('authenticated','public.smm_admins','INSERT')
     OR has_table_privilege('anon','public.smm_admins','UPDATE')
     OR has_table_privilege('authenticated','public.smm_admins','UPDATE')
     OR has_table_privilege('anon','public.smm_admins','DELETE')
     OR has_table_privilege('authenticated','public.smm_admins','DELETE') THEN
    RAISE EXCEPTION 'RC487_CLIENT_SMM_ADMIN_TABLE_PRIVILEGE_EXPOSURE';
  END IF;

  IF NOT has_table_privilege('service_role','public.smm_admins','SELECT') THEN
    RAISE EXCEPTION 'RC487_SERVICE_ROLE_ALLOWLIST_READ_MISSING';
  END IF;
  IF has_table_privilege('service_role','public.smm_admins','INSERT')
     OR has_table_privilege('service_role','public.smm_admins','UPDATE')
     OR has_table_privilege('service_role','public.smm_admins','DELETE')
     OR has_table_privilege('service_role','public.smm_admins','TRUNCATE') THEN
    RAISE EXCEPTION 'RC487_SERVICE_ROLE_MUST_NOT_MUTATE_SMM_ADMIN_ALLOWLIST';
  END IF;
END;
$rc487$;

SELECT 'RC487 SMM first-user bootstrap removal + allowlist ACL contract: PASS' AS result;
