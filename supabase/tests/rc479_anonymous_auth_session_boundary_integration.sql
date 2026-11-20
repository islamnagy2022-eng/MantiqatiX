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

-- Confirmed owner retains the existing owner-scoped DML policy.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  false
);
DO $owner_update$
DECLARE affected integer;
BEGIN
  UPDATE public.marketing_provider_profiles
  SET settings = jsonb_set(settings, '{owner_regression}', 'true'::jsonb, true)
  WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'RC479_OWNER_DML_REGRESSED:%', affected;
  END IF;
END
$owner_update$;
RESET ROLE;

-- Wrong owner must remain unable to update another provider profile.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false}',
  false
);
DO $wrong_owner$
DECLARE affected integer;
BEGIN
  UPDATE public.marketing_provider_profiles
  SET settings = jsonb_set(settings, '{wrong_owner_regression}', 'true'::jsonb, true)
  WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'RC479_WRONG_OWNER_DML_SUCCEEDED:%', affected;
  END IF;
END
$wrong_owner$;
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
DO $owner_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='marketing_provider_profiles'
      AND policyname='Owners manage their marketing provider profile'
      AND cmd='ALL'
      AND 'authenticated'=ANY(roles)
      AND qual LIKE '%auth.uid()%owner_user_id%'
      AND with_check LIKE '%auth.uid()%owner_user_id%'
  ) THEN
    RAISE EXCEPTION 'RC479_OWNER_POLICY_CHANGED_OR_MISSING';
  END IF;
END
$owner_policy$;
SELECT 'RC479 anonymous Auth-session forward migration + owner DML boundary: PASS' AS result;
