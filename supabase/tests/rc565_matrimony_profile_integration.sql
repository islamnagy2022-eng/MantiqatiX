-- RC565 behavioral integration tests. Disposable PostgreSQL only.
DO $test$
DECLARE
  actor uuid := '10000000-0000-4000-8000-000000005651';
  other_user uuid := '10000000-0000-4000-8000-000000005652';
  own_visible integer;
  other_private integer;
  public_count integer;
  result_columns text;
  rejected boolean := false;
BEGIN
  INSERT INTO public.matrimony_profiles (
    id, owner_user_id, gender, pseudonym, age, city, country, nationality,
    education, occupation, marital_status, religiosity_level, housing_status,
    financial_status, about_me, partner_requirements, wali_contact_name,
    wali_contact_phone, direct_contact_phone, is_verified, compatibility_tags
  ) VALUES
    ('20000000-0000-4000-8000-000000005651', actor, 'F', 'Owner Profile', 29, 'Giza', 'Egypt', 'Egyptian',
     'University', 'Teacher', 'Single', 'PRIVATE-RELIGION', 'PRIVATE-HOUSING',
     'PRIVATE-FINANCE', 'PRIVATE-BIO', 'PRIVATE-REQUIREMENTS', 'PRIVATE-WALI',
     '+201000000001', '+201000000002', true, '{"private_tag":"do-not-expose"}'),
    ('20000000-0000-4000-8000-000000005652', other_user, 'F', 'Verified Public', 27, 'Cairo', 'Egypt', 'Egyptian',
     'College', 'Engineer', 'Single', 'PRIVATE-RELIGION', 'PRIVATE-HOUSING',
     'PRIVATE-FINANCE', 'PRIVATE-BIO', 'PRIVATE-REQUIREMENTS', 'PRIVATE-WALI',
     '+201000000003', '+201000000004', true, '{"private_tag":"do-not-expose"}'),
    ('20000000-0000-4000-8000-000000005653', other_user, 'M', 'Unverified Private', 31, 'Alexandria', 'Egypt', 'Egyptian',
     'College', 'Doctor', 'Single', 'PRIVATE-RELIGION', 'PRIVATE-HOUSING',
     'PRIVATE-FINANCE', 'PRIVATE-BIO', 'PRIVATE-REQUIREMENTS', 'PRIVATE-WALI',
     '+201000000005', '+201000000006', false, '{"private_tag":"do-not-expose"}');

  IF has_function_privilege('anon', 'public.list_matrimony_public_profiles_backend(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute public matrimony discovery';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.list_matrimony_public_profiles_backend(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated users must execute public discovery';
  END IF;

  SELECT pg_catalog.pg_get_function_result(
    'public.list_matrimony_public_profiles_backend(integer)'::regprocedure
  ) INTO result_columns;
  IF result_columns ILIKE '%phone%'
     OR result_columns ILIKE '%owner_user_id%'
     OR result_columns ILIKE '%financial_status%'
     OR result_columns ILIKE '%religiosity_level%'
     OR result_columns ILIKE '%about_me%'
     OR result_columns ILIKE '%partner_requirements%'
     OR result_columns ILIKE '%compatibility_tags%' THEN
    RAISE EXCEPTION 'private profile fields appear in public RPC result: %', result_columns;
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', actor::text, false);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub', actor::text, 'role', 'authenticated', 'is_anonymous', false)::text, false);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO own_visible FROM public.matrimony_profiles;
  IF own_visible <> 1 THEN
    RAISE EXCEPTION 'direct table SELECT must expose only the owner profile; got %', own_visible;
  END IF;

  SELECT count(*) INTO other_private FROM public.matrimony_profiles
  WHERE owner_user_id = other_user;
  IF other_private <> 0 THEN
    RAISE EXCEPTION 'direct table SELECT exposed another user private profile';
  END IF;

  SELECT count(*) INTO public_count FROM public.list_matrimony_public_profiles_backend(500);
  IF public_count <> 2 THEN
    RAISE EXCEPTION 'discovery must return verified profiles only and clamp limit; got %', public_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.list_matrimony_public_profiles_backend(100)
    WHERE pseudonym = 'Unverified Private'
  ) THEN
    RAISE EXCEPTION 'unverified profile must not be discoverable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.list_matrimony_public_profiles_backend(100)
    WHERE pseudonym IN ('PRIVATE-WALI', 'PRIVATE-BIO', 'PRIVATE-REQUIREMENTS')
  ) THEN
    RAISE EXCEPTION 'private profile values leaked through public discovery';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', false);
  PERFORM pg_catalog.set_config('request.jwt.claims', '{"role":"authenticated","is_anonymous":false}', false);
  BEGIN
    PERFORM * FROM public.list_matrimony_public_profiles_backend(50);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'AUTHENTICATED_USER_REQUIRED' THEN rejected := true; ELSE RAISE; END IF;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'unauthenticated discovery call must be rejected'; END IF;

  RESET ROLE;
END;
$test$;

SELECT 'RC565 matrimony public/private boundary integration: PASS' AS result;
