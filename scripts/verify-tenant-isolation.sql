-- Controlled two-tenant authorization verification.
-- Requires the synthetic fixture in supabase/tests/baselines/tenant_isolation_two_tenant_fixture.sql.
-- Run only in disposable PostgreSQL/CI. Never run this fixture-dependent verifier against production.
-- The preflight fails closed if any required tenant, identity, or target row is absent.
BEGIN;

DO $preflight$
DECLARE
  v_user_a uuid := '20000000-0000-4000-8000-000000000001';
  v_user_b uuid := '20000000-0000-4000-8000-000000000002';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id='MNTY-TEST-A') THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_TENANT_A';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id='MNTY-TEST-B') THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_TENANT_B';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id=v_user_a AND tenant_id='MNTY-TEST-A'
      AND status='ACTIVE' AND upper(role)='OWNER'
  ) OR EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id=v_user_a AND status='ACTIVE' AND tenant_id<>'MNTY-TEST-A'
  ) THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_ISOLATED_OWNER_A';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id=v_user_b AND tenant_id='MNTY-TEST-B'
      AND status='ACTIVE' AND upper(role)='OWNER'
  ) OR EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id=v_user_b AND status='ACTIVE' AND tenant_id<>'MNTY-TEST-B'
  ) THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_ISOLATED_OWNER_B';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE tenant_id='MNTY-TEST-A' AND status='INACTIVE' AND coalesce(settings->>'showcase','false')<>'true')
     OR NOT EXISTS (SELECT 1 FROM public.businesses WHERE tenant_id='MNTY-TEST-B' AND status='INACTIVE' AND coalesce(settings->>'showcase','false')<>'true') THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_PRIVATE_BUSINESS_ROWS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE tenant_id='MNTY-TEST-A')
     OR NOT EXISTS (SELECT 1 FROM public.orders WHERE tenant_id='MNTY-TEST-B') THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_ORDER_ROWS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.payment_intents WHERE tenant_id='MNTY-TEST-A')
     OR NOT EXISTS (SELECT 1 FROM public.payment_intents WHERE tenant_id='MNTY-TEST-B') THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_PAYMENT_INTENT_ROWS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-A')
     OR NOT EXISTS (SELECT 1 FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-B') THEN
    RAISE EXCEPTION 'E2E_FIXTURE_MISSING_ONBOARDING_ROWS';
  END IF;
END;
$preflight$;

SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE authenticated;

DO $tenant_a$
DECLARE
  v_own_businesses bigint;
  v_cross_businesses bigint;
  v_own_orders bigint;
  v_cross_orders bigint;
  v_own_payments bigint;
  v_cross_payments bigint;
  v_own_onboarding bigint;
  v_cross_onboarding bigint;
BEGIN
  SELECT count(*) INTO v_own_businesses FROM public.businesses WHERE tenant_id='MNTY-TEST-A' AND NOT (status='ACTIVE' AND coalesce(settings->>'showcase','false')='true');
  SELECT count(*) INTO v_cross_businesses FROM public.businesses WHERE tenant_id='MNTY-TEST-B' AND NOT (status='ACTIVE' AND coalesce(settings->>'showcase','false')='true');
  SELECT count(*) INTO v_own_orders FROM public.orders WHERE tenant_id='MNTY-TEST-A';
  SELECT count(*) INTO v_cross_orders FROM public.orders WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_own_payments FROM public.payment_intents WHERE tenant_id='MNTY-TEST-A';
  SELECT count(*) INTO v_cross_payments FROM public.payment_intents WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_own_onboarding FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-A';
  SELECT count(*) INTO v_cross_onboarding FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-B';

  IF v_own_businesses=0 OR v_own_orders=0 OR v_own_payments=0 OR v_own_onboarding=0 THEN
    RAISE EXCEPTION 'E2E_FIXTURE_OWN_ROWS_NOT_VISIBLE_TO_TENANT_A';
  END IF;
  IF v_cross_businesses<>0 OR v_cross_orders<>0 OR v_cross_payments<>0 OR v_cross_onboarding<>0 THEN
    RAISE EXCEPTION 'CROSS_TENANT_VISIBILITY_FROM_A: businesses=%, orders=%, payments=%, onboarding=%',
      v_cross_businesses,v_cross_orders,v_cross_payments,v_cross_onboarding;
  END IF;
  RAISE NOTICE 'PASS: Tenant A can read its own rows and cannot read private Tenant B rows';
END;
$tenant_a$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;

DO $tenant_b$
DECLARE
  v_own_businesses bigint;
  v_cross_businesses bigint;
  v_own_orders bigint;
  v_cross_orders bigint;
  v_own_payments bigint;
  v_cross_payments bigint;
  v_own_onboarding bigint;
  v_cross_onboarding bigint;
BEGIN
  SELECT count(*) INTO v_own_businesses FROM public.businesses WHERE tenant_id='MNTY-TEST-B' AND NOT (status='ACTIVE' AND coalesce(settings->>'showcase','false')='true');
  SELECT count(*) INTO v_cross_businesses FROM public.businesses WHERE tenant_id='MNTY-TEST-A' AND NOT (status='ACTIVE' AND coalesce(settings->>'showcase','false')='true');
  SELECT count(*) INTO v_own_orders FROM public.orders WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_cross_orders FROM public.orders WHERE tenant_id='MNTY-TEST-A';
  SELECT count(*) INTO v_own_payments FROM public.payment_intents WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_cross_payments FROM public.payment_intents WHERE tenant_id='MNTY-TEST-A';
  SELECT count(*) INTO v_own_onboarding FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-B';
  SELECT count(*) INTO v_cross_onboarding FROM public.provider_onboarding_requests WHERE tenant_id='MNTY-TEST-A';

  IF v_own_businesses=0 OR v_own_orders=0 OR v_own_payments=0 OR v_own_onboarding=0 THEN
    RAISE EXCEPTION 'E2E_FIXTURE_OWN_ROWS_NOT_VISIBLE_TO_TENANT_B';
  END IF;
  IF v_cross_businesses<>0 OR v_cross_orders<>0 OR v_cross_payments<>0 OR v_cross_onboarding<>0 THEN
    RAISE EXCEPTION 'CROSS_TENANT_VISIBILITY_FROM_B: businesses=%, orders=%, payments=%, onboarding=%',
      v_cross_businesses,v_cross_orders,v_cross_payments,v_cross_onboarding;
  END IF;
  RAISE NOTICE 'PASS: Tenant B can read its own rows and cannot read private Tenant A rows';
END;
$tenant_b$;

ROLLBACK;
