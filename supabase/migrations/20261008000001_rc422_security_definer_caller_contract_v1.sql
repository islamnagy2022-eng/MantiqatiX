-- RC422: fail-closed contract for exposed SECURITY DEFINER functions.
-- Every authenticated-callable SECURITY DEFINER function must bind the caller
-- directly, except reviewed helper/public-read functions whose own boundary is
-- established by a trusted SECURITY DEFINER helper or intentionally public ad read.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
    INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public'
    AND p.prosecdef
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    AND pg_get_functiondef(p.oid) NOT ILIKE '%auth.uid()%'
    AND p.proname NOT IN (
      'get_mnty_targeted_advertisements',
      'mnty_active_membership',
      'mnty_can',
      'mnty_can_platform_admin',
      'preview_commission_backend'
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'RC422_AUTH_CALLER_BINDING_MISSING: %', v_bad;
  END IF;
END $$;
