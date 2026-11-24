-- RC482 must already have converted the Legal helper to registry-only authority.
DO $rc482_dependency$
DECLARE
  v_definition text;
  v_config text[];
  v_definer boolean;
BEGIN
  IF to_regprocedure('private.legal_is_admin()') IS NOT NULL THEN
    RAISE EXCEPTION 'RC924_ZERO_ARGUMENT_LEGAL_ADMIN_OVERLOAD_REMAINS';
  END IF;
  SELECT pg_get_functiondef(p.oid), p.proconfig, p.prosecdef
    INTO v_definition, v_config, v_definer
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('private.legal_is_admin(uuid)');
  IF v_definition IS NULL OR v_definition NOT ILIKE '%FROM private.platform_admins%'
     OR v_definition ILIKE '%FROM public.user_memberships%' THEN
    RAISE EXCEPTION 'RC924_LEGAL_ADMIN_HELPER_NOT_REGISTRY_BACKED';
  END IF;
  IF NOT v_definer OR NOT ('search_path=""' = ANY(coalesce(v_config, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'RC924_LEGAL_ADMIN_HELPER_NOT_PINNED_SECURITY_DEFINER';
  END IF;
END;
$rc482_dependency$;

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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agreements'
      AND policyname='agreements_confirmed_auth_select'
      AND permissive='RESTRICTIVE' AND cmd='SELECT'
      AND 'authenticated'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'RC924_CONFIRMED_AUTH_RESTRICTIVE_POLICY_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agreements'
      AND policyname='agreements_admin_write'
      AND permissive='PERMISSIVE' AND cmd='ALL'
  ) THEN
    RAISE EXCEPTION 'RC924_EXISTING_ADMIN_FOR_ALL_POLICY_NOT_PRESERVED';
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

-- Participant A must also be unable to enumerate participant rows for B or C.
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
DO $participant_rows_a$
DECLARE v_ids uuid[];
BEGIN
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.agreement_participants;
  IF v_ids IS DISTINCT FROM ARRAY['20000000-0000-4000-8000-000000000001'::uuid] THEN
    RAISE EXCEPTION 'RC924_PARTICIPANT_ROWS_A_SCOPE_FAILURE: %',v_ids;
  END IF;
END;
$participant_rows_a$;

-- Ordinary tenant ADMIN, SUPER_ADMIN and delegated LEGAL_ADMIN labels
-- must not inherit platform-wide legal access or impersonate the root registry actor.
SET ROLE authenticated;
DO $tenant_admin_scope$
DECLARE
  v_actor uuid;
  v_count integer;
  v_actors uuid[] := ARRAY[
    '70000000-0000-4000-8000-000000000001'::uuid,
    '70000000-0000-4000-8000-000000000002'::uuid,
    '70000000-0000-4000-8000-000000000003'::uuid
  ];
BEGIN
  FOREACH v_actor IN ARRAY v_actors LOOP
    PERFORM set_config('request.jwt.claim.sub',v_actor::text,false);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub',v_actor::text,'role','authenticated','is_anonymous',false)::text,
      false
    );
    IF private.legal_is_admin() THEN
      RAISE EXCEPTION 'RC924_TENANT_ROLE_ESCALATED_TO_PLATFORM_LEGAL_ADMIN:%',v_actor;
    END IF;
    IF private.legal_is_admin('10000000-0000-4000-8000-000000000001') THEN
      RAISE EXCEPTION 'RC924_TENANT_ROLE_IMPERSONATED_PLATFORM_ADMIN:%',v_actor;
    END IF;
    SELECT count(*) INTO v_count FROM public.agreements;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'RC924_TENANT_ROLE_READ_CROSS_BUSINESS_AGREEMENTS:%:%',v_actor,v_count;
    END IF;
  END LOOP;
END;
$tenant_admin_scope$;
RESET ROLE;

SET ROLE authenticated;

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

-- A missing is_anonymous claim must fail closed, even for a matching participant.
SELECT set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
DO $missing_claim$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.agreements;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RC924_MISSING_ANONYMOUS_CLAIM_READS_AGREEMENTS: %',v_count;
  END IF;
END;
$missing_claim$;

-- Platform admin registry actor can read all agreements.
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
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
