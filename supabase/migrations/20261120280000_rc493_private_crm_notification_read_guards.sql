-- RC493: private CRM/project/notification reads require a confirmed Auth identity.
-- Existing self-ownership and active-membership predicates remain the permissive authorization layer.
BEGIN;

DO $preflight$
DECLARE v_table text;
DECLARE v_tables text[] := ARRAY['marketing_leads','marketing_projects','notifications'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF pg_catalog.to_regclass(format('public.%I',v_table)) IS NULL THEN
      RAISE EXCEPTION 'RC493_REQUIRED_PRIVATE_READ_TABLE_MISSING:%',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RC493_PRIVATE_READ_TABLE_RLS_DISABLED:%',v_table;
    END IF;
    IF NOT pg_catalog.has_table_privilege('authenticated',format('public.%I',v_table),'SELECT') THEN
      RAISE EXCEPTION 'RC493_EXPECTED_AUTHENTICATED_SELECT_GRANT_MISSING:%',v_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename=v_table
        AND policyname='rc493_confirmed_auth_select_guard'
    ) THEN
      RAISE EXCEPTION 'RC493_POLICY_ALREADY_EXISTS:%',v_table;
    END IF;
  END LOOP;
END;
$preflight$;

DO $install$
DECLARE v_table text;
DECLARE v_tables text[] := ARRAY['marketing_leads','marketing_projects','notifications'];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'CREATE POLICY rc493_confirmed_auth_select_guard ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT (auth.jwt()->>''is_anonymous'')::boolean) IS FALSE)',
      v_table
    );
    EXECUTE format(
      'COMMENT ON POLICY rc493_confirmed_auth_select_guard ON public.%I IS %L',
      v_table,
      'RC493: private CRM, project and notification reads require a confirmed Auth identity; existing owner/membership predicates remain in force.'
    );
  END LOOP;
END;
$install$;

COMMIT;
