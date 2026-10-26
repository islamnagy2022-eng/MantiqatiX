-- Read-only authorization verification for a disposable CI/development database only.
-- NEVER run against production. The production tenant-isolation fixtures were retired on 2026-10-26.
-- Seed the isolated local/CI baseline fixture first; missing fixture rows fail closed instead of passing vacuously.
BEGIN;

DO $fixture_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id='MNTY-TEST-B' AND code='S05-TEST-B'
      AND settings->>'test_fixture'='true'
  ) THEN
    RAISE EXCEPTION 'BLOCKED: MNTY-TEST-B disposable fixture is missing; do not run this verifier against production';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE tenant_id='MNTY-TEST-B' AND coalesce(settings->>'test_fixture','false')='true') THEN
    RAISE EXCEPTION 'BLOCKED: isolated fixture business is missing';
  END IF;
END;
$fixture_preflight$;

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_user uuid;
  v_businesses bigint;
  v_orders bigint;
  v_payments bigint;
  v_onboarding bigint;
BEGIN
  SELECT um.user_id INTO v_user
  FROM public.user_memberships um
  WHERE um.status='ACTIVE'
    AND um.tenant_id='MNTY-PLATFORM'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_memberships x
      WHERE x.user_id=um.user_id
        AND x.status='ACTIVE'
        AND x.tenant_id='MNTY-TEST-B'
    )
  ORDER BY um.user_id
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'BLOCKED: no independent platform-only identity is available; this runtime check is not verified';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  SELECT count(*) INTO v_businesses FROM public.businesses WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_orders FROM public.orders WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_payments FROM public.payment_intents WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_onboarding FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-B';

  IF v_businesses <> 0 OR v_orders <> 0 OR v_payments <> 0 OR v_onboarding <> 0 THEN
    RAISE EXCEPTION 'FAIL: cross-tenant visibility detected: businesses=%, orders=%, payments=%, onboarding=%',
      v_businesses, v_orders, v_payments, v_onboarding;
  END IF;

  RAISE NOTICE 'PASS: platform-only authenticated identity cannot read TEST-B rows';
END $$;

ROLLBACK;
