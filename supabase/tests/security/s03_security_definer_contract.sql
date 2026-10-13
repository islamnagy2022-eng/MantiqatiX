-- S03 SECURITY DEFINER contract checks
-- Read-only catalog assertions; safe to execute against an isolated test database.
-- This script intentionally does not invoke business RPCs or perform DML/DDL.
DO $s03$
DECLARE
  v_def text;
  v_count integer;
  v_bad integer;
BEGIN
  -- The public ad-serving RPC is intentionally anonymous only if the product
  -- contract confirms that its returned fields are public. This test records
  -- the observed contract and will fail if the exposure/filters silently drift.
  SELECT pg_get_functiondef(p.oid)
    INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_mnty_targeted_advertisements'
    AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'S03: expected anon-executable SECURITY DEFINER ad RPC not found';
  END IF;
  IF v_def NOT ILIKE '%status=''ACTIVE''%'
     OR v_def NOT ILIKE '%approval_status=''APPROVED''%'
     OR v_def NOT ILIKE '%start_at is null%'
     OR v_def NOT ILIKE '%end_at is null%'
     OR v_def NOT ILIKE '%least(coalesce(p_limit,3),50)%' THEN
    RAISE EXCEPTION 'S03: public ad RPC active/approved/date/limit contract drifted';
  END IF;
  IF v_def ~* '\mexecute\M' THEN
    RAISE EXCEPTION 'S03: unexpected dynamic EXECUTE token in public ad RPC';
  END IF;

  -- Critical operations must bind supplied actor IDs to auth.uid() and enforce
  -- the platform-admin gate. This checks definitions, never calls the RPCs.
  FOR v_def IN
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'admin_create_global_ad',
        'review_mantigo_captain_application',
        'set_mantigo_financial_config_backend',
        'fulfill_digital_page_publish'
      )
      AND p.prosecdef
  LOOP
    IF v_def NOT ILIKE '%mnty_can_platform_admin%'
       OR v_def NOT ILIKE '%auth.uid()%' THEN
      RAISE EXCEPTION 'S03: missing actor/admin guard in privileged function definition';
    END IF;
  END LOOP;

  -- All callable SECURITY DEFINER overloads in scope must set search_path.
  -- Four S02-owned functions are intentionally excluded.
  SELECT count(*)
    INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND p.prosecdef
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
         OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    AND p.proname NOT IN (
      'get_mantigo_admin_dashboard_backend',
      'get_mantigo_admin_financial_report_backend',
      'settle_mantigo_captain_backend',
      'expire_stale_mantigo_rides_backend'
    )
    AND (p.proconfig IS NULL OR NOT EXISTS (
      SELECT 1 FROM unnest(p.proconfig) AS cfg
      WHERE cfg LIKE 'search_path=%'
    ));
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'S03: % callable SECURITY DEFINER functions lack explicit search_path', v_count;
  END IF;

  -- Confirm the definitions currently present include the required identity
  -- and admin checks. Missing functions fail closed instead of being skipped.
  SELECT count(*)
    INTO v_count
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname IN (
      'admin_create_global_ad',
      'review_mantigo_captain_application',
      'set_mantigo_financial_config_backend',
      'fulfill_digital_page_publish'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'S03: expected 4 privileged functions to inspect, found %', v_count;
  END IF;

  RAISE NOTICE 'S03 read-only SECURITY DEFINER contract assertions passed';
END
$s03$;
