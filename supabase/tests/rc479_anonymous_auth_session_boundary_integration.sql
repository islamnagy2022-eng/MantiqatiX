-- Disposable-only regression for anonymous Auth sessions against marketing provider profiles.
-- Run after rc479_provider_profile_anon_read_fixture.sql, RC479 migration, and the
-- existing RC479 raw-anon/authenticated/service-role integration test.
-- This file deliberately reproduces the remaining gap, then applies a TEST-ONLY
-- restrictive-policy overlay to define the required forward-migration contract.
-- Never apply this test overlay or fixture to Production.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$function$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;

-- Baseline after RC479: raw anon is denied, but an anonymous Auth session has
-- role=authenticated and still satisfies the legacy public-active SELECT policy.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  false
);
DO $baseline$
DECLARE
  visible_private_rows integer;
BEGIN
  SELECT count(*) INTO visible_private_rows
  FROM public.marketing_provider_profiles
  WHERE owner_user_id IS NOT NULL AND settings IS NOT NULL;

  IF visible_private_rows <> 1 THEN
    RAISE EXCEPTION 'RC479_ANONYMOUS_AUTH_BASELINE_NOT_REPRODUCED:%', visible_private_rows;
  END IF;
END
$baseline$;
RESET ROLE;

-- Test-only representation of the required forward-only fix. The real migration
-- must be generated with Supabase CLI and reviewed against the complete release chain.
CREATE POLICY rc479_test_only_anonymous_auth_session_deny
ON public.marketing_provider_profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false);

-- Anonymous Auth sessions must no longer see owner_user_id/settings or any rows.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  false
);
DO $anonymous$
DECLARE
  visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows
  FROM public.marketing_provider_profiles
  WHERE owner_user_id IS NOT NULL AND settings IS NOT NULL;

  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'RC479_ANONYMOUS_AUTH_PRIVATE_PROFILE_READ_REMAINS:%', visible_rows;
  END IF;
END
$anonymous$;
RESET ROLE;

-- Confirmed authenticated users retain the intended public-active profile read.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  false
);
DO $confirmed$
DECLARE
  visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows
  FROM public.marketing_provider_profiles
  WHERE owner_user_id IS NOT NULL AND settings IS NOT NULL;

  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'RC479_CONFIRMED_AUTHENTICATED_PROFILE_READ_REGRESSED:%', visible_rows;
  END IF;
END
$confirmed$;
RESET ROLE;

SELECT 'RC479 anonymous Auth session boundary: PASS (baseline gap reproduced; test-only restrictive overlay verified)' AS result;
