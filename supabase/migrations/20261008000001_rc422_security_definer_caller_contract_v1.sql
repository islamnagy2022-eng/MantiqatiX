-- RC422: fail-closed contract for exposed SECURITY DEFINER functions.
-- Every authenticated-callable SECURITY DEFINER function must bind the caller
-- directly, except reviewed helper/public-read functions whose own boundary is
-- established by a trusted SECURITY DEFINER helper or intentionally public ad read.
DO $$
DECLARE
  v_bad text;
  v_settlement_def text;
  v_membership_def text;
BEGIN
  -- This settlement RPC delegates its caller/tenant/finance-role contract to
  -- assert_financial_membership(p_tenant_id). Keep the exception narrow and
  -- prove the delegated guard still binds auth.uid() before accepting it.
  SELECT pg_get_functiondef(
    'public.create_settlement_backend(character varying,character varying,character varying,numeric,numeric,numeric,numeric,character varying,character varying)'::regprocedure
  ) INTO v_settlement_def;
  SELECT pg_get_functiondef(
    'public.assert_financial_membership(character varying)'::regprocedure
  ) INTO v_membership_def;

  IF v_settlement_def NOT ILIKE '%assert_financial_membership%' OR
     v_membership_def NOT ILIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'RC422_SETTLEMENT_DELEGATED_AUTH_CONTRACT_MISSING';
  END IF;

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
      'preview_commission_backend',
      'create_settlement_backend'
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'RC422_AUTH_CALLER_BINDING_MISSING: %', v_bad;
  END IF;
END $$;
