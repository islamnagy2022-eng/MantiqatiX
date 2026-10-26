-- Repeatable DEMO-only behavior test for the future-time guard.
-- Run manually against MantiqatiX-DEMO using an elevated SQL connection.
-- It performs no INSERT/UPDATE/DELETE and must never be used as a LIVE migration.
DO $demo_test$
DECLARE
  v_user uuid := '00000000-0000-0000-0000-000000000001';
  v_business uuid := '00000000-0000-0000-0000-000000000002';
  v_message text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);

  BEGIN
    PERFORM public.create_medical_appointment_backend(
      v_user, 'demo-past-guard-test', v_business, 'demo-provider',
      (extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint - 10000,
      'synthetic non-persistent guard test'
    );
    RAISE EXCEPTION 'TEST_ASSERTION_FAILED: past appointment unexpectedly passed';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'APPOINTMENT_TIME_MUST_BE_FUTURE' THEN
      RAISE EXCEPTION 'TEST_ASSERTION_FAILED: expected APPOINTMENT_TIME_MUST_BE_FUTURE, got %', v_message;
    END IF;
  END;
  RAISE NOTICE 'PASS: past/current appointment timestamp is rejected';

  BEGIN
    PERFORM public.create_medical_appointment_backend(
      v_user, 'demo-future-guard-test', v_business, 'demo-provider',
      (extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint + 86400000,
      'synthetic non-persistent guard test'
    );
    RAISE EXCEPTION 'TEST_ASSERTION_FAILED: missing business unexpectedly passed';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'ACTIVE_MEDICAL_PROVIDER_NOT_FOUND' THEN
      RAISE EXCEPTION 'TEST_ASSERTION_FAILED: future timestamp did not pass the time guard; got %', v_message;
    END IF;
  END;
  RAISE NOTICE 'PASS: future timestamp passes time guard and continues to provider scope validation';
END;
$demo_test$;
