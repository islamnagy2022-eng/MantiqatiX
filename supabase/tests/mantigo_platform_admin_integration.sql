-- Integration authorization checks for 20261009170000_mantigo_platform_admin_scope_hardening.sql.
-- Executed only by CI against a disposable PostgreSQL database.
SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
SET ROLE authenticated;

DO $tests$
DECLARE
  result jsonb;
BEGIN
  -- Authorized platform admin can read platform-wide dashboard and financial totals.
  result := public.get_mantigo_admin_dashboard_backend('11111111-1111-4111-8111-111111111111');
  IF (result->>'rides_total')::integer <> 2 OR (result->>'revenue')::numeric <> 100 THEN
    RAISE EXCEPTION 'TEST_FAILED: authorized dashboard totals mismatch: %', result;
  END IF;

  result := public.get_mantigo_admin_financial_report_backend(
    '11111111-1111-4111-8111-111111111111', now()-interval '1 day', now()+interval '1 day'
  );
  IF (result->>'ledger_count')::integer <> 1 OR (result->>'gross')::numeric <> 100 THEN
    RAISE EXCEPTION 'TEST_FAILED: authorized financial report mismatch: %', result;
  END IF;

  result := public.expire_stale_mantigo_rides_backend('11111111-1111-4111-8111-111111111111', 30);
  IF (result->>'expired_count')::integer <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: expected one stale ride expiration, got %', result;
  END IF;

  -- A business OWNER in an unrelated tenant must not see global metrics or mutate rides.
  PERFORM set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', false);
  BEGIN
    PERFORM public.get_mantigo_admin_dashboard_backend('22222222-2222-4222-8222-222222222222');
    RAISE EXCEPTION 'TEST_FAILED: unrelated tenant owner accessed dashboard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT IN ('PLATFORM_ADMIN_REQUIRED') THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.get_mantigo_admin_financial_report_backend('22222222-2222-4222-8222-222222222222', NULL, NULL);
    RAISE EXCEPTION 'TEST_FAILED: unrelated tenant owner accessed financial report';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT IN ('PLATFORM_ADMIN_REQUIRED') THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.expire_stale_mantigo_rides_backend('22222222-2222-4222-8222-222222222222', 30);
    RAISE EXCEPTION 'TEST_FAILED: unrelated tenant owner expired rides';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT IN ('PLATFORM_ADMIN_REQUIRED') THEN RAISE; END IF;
  END;

  -- Actor spoofing is rejected even when a valid platform admin exists.
  PERFORM set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
  BEGIN
    PERFORM public.get_mantigo_admin_financial_report_backend('22222222-2222-4222-8222-222222222222', NULL, NULL);
    RAISE EXCEPTION 'TEST_FAILED: actor-id mismatch accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT IN ('AUTH_REQUIRED') THEN RAISE; END IF;
  END;

  -- An inactive platform membership must not authorize global access.
  PERFORM set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', false);
  BEGIN
    PERFORM public.get_mantigo_admin_dashboard_backend('33333333-3333-4333-8333-333333333333');
    RAISE EXCEPTION 'TEST_FAILED: inactive platform admin accessed dashboard';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT IN ('PLATFORM_ADMIN_REQUIRED') THEN RAISE; END IF;
  END;
END
$tests$;

RESET ROLE;
DO $verify$
BEGIN
  IF (SELECT status FROM public.mantigo_rides WHERE id='stale-ride') <> 'EXPIRED' THEN
    RAISE EXCEPTION 'TEST_FAILED: stale ride status was not persisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE action='MANTIGO_RIDE_EXPIRED' AND entity_id='stale-ride') THEN
    RAISE EXCEPTION 'TEST_FAILED: stale ride expiration audit event missing';
  END IF;
END
$verify$;

SELECT 'MNTY platform-admin integration tests: PASS' AS result;
