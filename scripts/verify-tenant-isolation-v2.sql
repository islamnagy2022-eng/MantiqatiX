-- Read-only authorization verification. Run inside a transaction; this script always rolls back.
-- It reports BLOCKED when no independent platform-only identity exists.
BEGIN;
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
    RAISE NOTICE 'BLOCKED: no independent platform-only identity is available; create/use an authorized test identity before runtime E2E';
    RETURN;
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
