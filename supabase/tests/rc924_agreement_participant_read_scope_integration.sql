-- Run after RC924 fixture and migration in disposable PostgreSQL.
DO $precondition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agreements'
      AND policyname='agreements_participant_read'
      AND permissive='PERMISSIVE' AND cmd='SELECT'
  ) THEN
    RAISE EXCEPTION 'RC924_PARTICIPANT_SELECT_POLICY_MISSING';
  END IF;
  IF (
    SELECT qual FROM pg_policies
    WHERE schemaname='public' AND tablename='agreements'
      AND policyname='agreements_participant_read'
  ) NOT LIKE '%agreements.id%' THEN
    RAISE EXCEPTION 'RC924_POLICY_MUST_CORRELATE_TO_PARENT_AGREEMENT_ID';
  END IF;
END;
$precondition$;

-- Participant A sees only agreement A, not B or C.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
DO $participant_a$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.agreements;
  IF v_ids IS DISTINCT FROM ARRAY['10000000-0000-4000-8000-000000000001'::uuid] THEN
    RAISE EXCEPTION 'RC924_PARTICIPANT_A_SCOPE_FAILURE: %',v_ids;
  END IF;
END;
$participant_a$;

-- Participant B sees only agreement B.
SELECT set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claims','{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
DO $participant_b$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.agreements;
  IF v_ids IS DISTINCT FROM ARRAY['10000000-0000-4000-8000-000000000002'::uuid] THEN
    RAISE EXCEPTION 'RC924_PARTICIPANT_B_SCOPE_FAILURE: %',v_ids;
  END IF;
END;
$participant_b$;

-- An authenticated but unrelated user sees no agreements.
SELECT set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000006',false);
SELECT set_config('request.jwt.claims','{"sub":"60000000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":false}',false);
DO $unrelated$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.agreements;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC924_UNRELATED_USER_READS_AGREEMENTS: %',v_count;
  END IF;
END;
$unrelated$;

-- Anonymous-authenticated JWT must be blocked even when a participant ID matches.
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',false);
DO $anonymous$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.agreements;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC924_ANONYMOUS_AUTH_USER_READS_AGREEMENTS: %',v_count;
  END IF;
END;
$anonymous$;

-- Platform admin registry actor can read all agreements.
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000009',false);
SELECT set_config('request.jwt.claims','{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated","is_anonymous":false}',false);
DO $platform_admin$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.agreements;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'RC924_PLATFORM_ADMIN_SCOPE_FAILURE: %',v_count;
  END IF;
END;
$platform_admin$;
RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claims;

SELECT 'RC924 agreement participant read scope: PASS' AS result;
