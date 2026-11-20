-- Disposable-only regression after the real forward migration.
-- Verifies anonymous Auth denial and confirmed-user compatibility.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  false
);
DO $anonymous$
DECLARE visible_rows integer;
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

SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  false
);
DO $confirmed$
DECLARE visible_rows integer;
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

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='marketing_provider_profiles'
      AND policyname='marketing_provider_profiles_confirmed_auth_select'
      AND permissive='RESTRICTIVE'
      AND cmd='SELECT'
      AND 'authenticated'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'RC479_FORWARD_RESTRICTIVE_SELECT_POLICY_MISSING';
  END IF;
END
$policy$;
SELECT 'RC479 anonymous Auth-session forward migration: PASS' AS result;
