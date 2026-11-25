-- The full chronological replay starts from a schema-only Production checkpoint.
-- It has no provider-profile rows. Seed only deterministic disposable test data here.
-- The RC479 unit fixture already has the row, so this is an idempotent upsert.
DO $fixture$
DECLARE
  v_owner uuid := 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b';
  v_id uuid := '10000000-0000-4000-8000-000000000001';
  v_has_full_schema boolean;
  v_owner_exists boolean;
BEGIN
  IF pg_catalog.to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM auth.users WHERE id=$1)'
      INTO v_owner_exists USING v_owner;
    IF v_owner_exists IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'RC926_DISPOSABLE_OWNER_AUTH_USER_FIXTURE_MISSING';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='marketing_provider_profiles'
       AND column_name='provider_kind'
  ) INTO v_has_full_schema;

  IF v_has_full_schema THEN
    INSERT INTO public.marketing_provider_profiles
      (id,provider_kind,business_id,owner_user_id,name_ar,slug,status,settings)
    VALUES
      (v_id,'OFFICIAL',NULL,v_owner,'RC926 Synthetic Provider','rc926-synthetic-provider','ACTIVE','{"test_fixture":true}'::jsonb)
    ON CONFLICT (id) DO UPDATE
      SET business_id=NULL,
          owner_user_id=EXCLUDED.owner_user_id,
          status='ACTIVE',
          settings=EXCLUDED.settings;
  ELSE
    INSERT INTO public.marketing_provider_profiles
      (id,owner_user_id,name_ar,settings,status)
    VALUES
      (v_id,v_owner,'RC926 Synthetic Provider','{"test_fixture":true}'::jsonb,'ACTIVE')
    ON CONFLICT (id) DO UPDATE
      SET owner_user_id=EXCLUDED.owner_user_id,
          settings=EXCLUDED.settings,
          status='ACTIVE';
  END IF;
END;
$fixture$;

-- RC926 adversarial regression. Disposable PostgreSQL / Supabase replay only.
-- Tests raw anon, Anonymous Auth, missing claim, confirmed user and owner DML compatibility.

DO $acl$
BEGIN
  IF has_table_privilege('anon','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC926_RAW_ANON_SELECT_STILL_GRANTED';
  END IF;
  IF NOT has_table_privilege('authenticated','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC926_AUTHENTICATED_SELECT_REMOVED';
  END IF;
  IF NOT has_table_privilege('service_role','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC926_SERVICE_ROLE_SELECT_REMOVED';
  END IF;
END;
$acl$;

SET ROLE anon;
DO $raw_anon$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.marketing_provider_profiles;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'RC926_RAW_ANON_PROVIDER_PROFILE_READ_SUCCEEDED';
  END IF;
END;
$raw_anon$;
RESET ROLE;

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
    RAISE EXCEPTION 'RC926_ANONYMOUS_AUTH_PROVIDER_PROFILE_READ_SUCCEEDED:%',visible_rows;
  END IF;
END;
$anonymous$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',
  false
);
DO $missing_claim$
DECLARE visible_rows integer;
BEGIN
  SELECT count(*) INTO visible_rows
  FROM public.marketing_provider_profiles
  WHERE owner_user_id IS NOT NULL AND settings IS NOT NULL;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'RC926_MISSING_ANONYMOUS_CLAIM_PROVIDER_PROFILE_READ_SUCCEEDED:%',visible_rows;
  END IF;
END;
$missing_claim$;
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
  -- Assert the deterministic RC926 row is readable. Do not assume it is the
  -- only active provider in a full chronological replay with other fixtures.
  SELECT count(*) INTO visible_rows
  FROM public.marketing_provider_profiles
  WHERE id='10000000-0000-4000-8000-000000000001'
    AND owner_user_id IS NOT NULL
    AND settings IS NOT NULL;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'RC926_CONFIRMED_USER_READ_REGRESSED:%',visible_rows;
  END IF;
END;
$confirmed$;
RESET ROLE;

-- The restrictive policy is SELECT-only; the existing confirmed owner update remains valid.
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"f7914ac7-4b03-4456-afdd-e386f2ac6a5b","role":"authenticated","is_anonymous":false}',
  false
);
DO $owner_update$
DECLARE affected integer;
BEGIN
  UPDATE public.marketing_provider_profiles
     SET settings=jsonb_set(settings,'{rc926_owner_regression}','true'::jsonb,true)
   WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'RC926_CONFIRMED_OWNER_UPDATE_REGRESSED:%',affected;
  END IF;
END;
$owner_update$;
RESET ROLE;

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
     SET settings=jsonb_set(settings,'{rc926_wrong_owner_regression}','true'::jsonb,true)
   WHERE id='10000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'RC926_WRONG_OWNER_UPDATE_SUCCEEDED:%',affected;
  END IF;
END;
$wrong_owner$;
RESET ROLE;

DO $policy$
DECLARE
  v_policy_count integer;
BEGIN
  SELECT count(*) INTO v_policy_count
    FROM pg_catalog.pg_policies
   WHERE schemaname='public'
     AND tablename='marketing_provider_profiles'
     AND policyname='marketing_provider_profiles_confirmed_auth_select'
     AND permissive='RESTRICTIVE'
     AND cmd='SELECT'
     AND 'authenticated'=ANY(roles)
     AND qual IS NOT NULL;

  IF v_policy_count <> 1 THEN
    RAISE EXCEPTION 'RC926_STRICT_CONFIRMED_IDENTITY_POLICY_MISSING_OR_WEAK';
  END IF;
END;
$policy$;

SELECT 'RC926 provider-profile raw anon, anonymous, missing-claim, confirmed-user and owner compatibility: PASS' AS result;
