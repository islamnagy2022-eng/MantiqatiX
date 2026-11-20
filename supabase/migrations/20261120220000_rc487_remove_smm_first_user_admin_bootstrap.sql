-- RC487: remove first-auth-user-wins SMM admin privilege bootstrap.
-- Existing allowlist rows are preserved. New administrators require an explicit
-- trusted database-operator action; public Auth signup must never grant SMM admin.
BEGIN;

DO $preflight$
DECLARE
  v_function oid := pg_catalog.to_regprocedure('public.smm_bootstrap_first_admin()');
BEGIN
  IF pg_catalog.to_regclass('public.smm_admins') IS NULL THEN
    RAISE EXCEPTION 'RC487_SMM_ADMIN_ALLOWLIST_TABLE_MISSING';
  END IF;

  IF v_function IS NOT NULL AND EXISTS (
    SELECT 1
      FROM pg_catalog.pg_trigger t
     WHERE t.tgfoid = v_function
       AND NOT t.tgisinternal
       AND NOT (
         t.tgrelid = 'auth.users'::regclass
         AND t.tgname = 'trg_smm_bootstrap_admin'
       )
  ) THEN
    RAISE EXCEPTION 'RC487_UNEXPECTED_SMM_BOOTSTRAP_TRIGGER_DEPENDENCY';
  END IF;
END;
$preflight$;

DROP TRIGGER IF EXISTS trg_smm_bootstrap_admin ON auth.users;
DROP FUNCTION IF EXISTS public.smm_bootstrap_first_admin();

-- Deliberately do not alter public.smm_admins rows or widen any table grants.
COMMIT;
