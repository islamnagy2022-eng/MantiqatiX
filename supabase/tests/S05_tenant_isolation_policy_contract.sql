-- S05 tenant-isolation policy contract.
-- Static catalog contract only: this is NOT a behavioral multi-user RLS test.
-- Run only in disposable PostgreSQL/CI; never use this file to mutate production.
DO $s05$
DECLARE
  v_table text;
  v_oid oid;
  v_def text;
  v_cfg text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.tenants',
    'public.user_memberships',
    'public.branches',
    'public.businesses',
    'public.organizations',
    'public.tenant_modules'
  ] LOOP
    SELECT c.oid INTO v_oid FROM pg_class c
    WHERE c.oid = to_regclass(v_table);
    IF v_oid IS NULL THEN
      RAISE EXCEPTION 'S05 contract failed: missing table %', v_table;
    END IF;
    IF NOT (SELECT relrowsecurity AND relforcerowsecurity
            FROM pg_class WHERE oid = v_oid) THEN
      RAISE EXCEPTION 'S05 contract failed: RLS and FORCE RLS must be enabled on %', v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_memberships'
      AND policyname='memberships_select_self' AND cmd='SELECT'
      AND qual ILIKE '%user_id = auth.uid()%'
  ) THEN
    RAISE EXCEPTION 'S05 contract failed: memberships_select_self must bind reads to auth.uid()';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tenants'
      AND policyname='tenants_select_member' AND cmd='SELECT'
      AND qual ILIKE '%tenant_id%' AND qual ILIKE '%auth.uid()%'
      AND qual ILIKE '%ACTIVE%'
  ) THEN
    RAISE EXCEPTION 'S05 contract failed: tenants_select_member tenant/active membership boundary missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='branches'
      AND policyname='branches_member_read' AND cmd='SELECT'
      AND qual ILIKE '%tenant_id%' AND qual ILIKE '%auth.uid()%'
      AND qual ILIKE '%ACTIVE%'
  ) THEN
    RAISE EXCEPTION 'S05 contract failed: branches_member_read tenant/active membership boundary missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='businesses'
      AND policyname='Public can view official showcase businesses'
      AND cmd='SELECT' AND roles @> ARRAY['anon']::name[]
      AND qual ILIKE '%ACTIVE%' AND qual ILIKE '%showcase%'
  ) THEN
    RAISE EXCEPTION 'S05 contract failed: expected narrowly scoped public showcase policy missing';
  END IF;

  v_oid := to_regclass('public.digital_page_payment_events');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'S05 contract failed: missing public.digital_page_payment_events';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=v_oid) THEN
    RAISE EXCEPTION 'S05 contract failed: payment events RLS must remain enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='digital_page_payment_events') THEN
    RAISE EXCEPTION 'S05 review required: payment events now have RLS policies; review before accepting the change';
  END IF;

  FOREACH v_table IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    IF has_table_privilege('anon','public.digital_page_payment_events',v_table)
       OR has_table_privilege('authenticated','public.digital_page_payment_events',v_table)
       OR has_table_privilege('service_role','public.digital_page_payment_events',v_table) THEN
      RAISE EXCEPTION 'S05 contract failed: direct % privilege exists on payment events for anon/authenticated/service_role', v_table;
    END IF;
  END LOOP;

  v_oid := to_regprocedure('public.mnty_active_membership(character varying,uuid,character varying)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'S05 contract failed: mnty_active_membership signature missing';
  END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  SELECT array_to_string(proconfig, ',') INTO v_cfg FROM pg_proc WHERE oid=v_oid;
  IF NOT has_function_privilege('authenticated',v_oid,'EXECUTE')
     OR has_function_privilege('anon',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'S05 contract failed: mnty_active_membership EXECUTE boundary changed';
  END IF;
  IF v_cfg NOT ILIKE '%search_path=public, pg_temp%'
     OR v_def NOT ILIKE '%m.user_id = auth.uid()%'
     OR v_def NOT ILIKE '%m.status = ''ACTIVE''%' THEN
    RAISE EXCEPTION 'S05 contract failed: mnty_active_membership identity/status/search_path contract changed';
  END IF;

  v_oid := to_regprocedure('public.start_business_trial_backend(uuid,text,text,integer,text,uuid)');
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'S05 contract failed: start_business_trial_backend signature missing';
  END IF;
  IF has_function_privilege('anon',v_oid,'EXECUTE')
     OR has_function_privilege('authenticated',v_oid,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_oid,'EXECUTE') THEN
    RAISE EXCEPTION 'S05 contract failed: start_business_trial_backend must remain backend-only';
  END IF;

  RAISE NOTICE 'S05 static policy contract passed; behavioral tenant-isolation tests remain required.';
END
$s05$;
