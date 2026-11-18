-- RC479 privilege and compatibility integration test. Disposable PostgreSQL only.
-- The migration must remove only the anonymous table-level SELECT grant.
DO $test$
BEGIN
  IF has_table_privilege('anon','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC479_ANON_SELECT_STILL_GRANTED';
  END IF;
  IF NOT has_table_privilege('authenticated','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC479_AUTHENTICATED_SELECT_WAS_REMOVED';
  END IF;
  IF NOT has_table_privilege('service_role','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC479_SERVICE_ROLE_SELECT_WAS_REMOVED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='marketing_provider_profiles'
      AND policyname='Public can view active marketing providers'
      AND 'anon'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'RC479_EXISTING_PUBLIC_RLS_POLICY_WAS_UNEXPECTEDLY_CHANGED';
  END IF;
END;
$test$;

-- Anonymous role must fail at the table privilege boundary, even though the
-- legacy RLS policy remains for historical compatibility and authenticated reads.
SET ROLE anon;
DO $test$
DECLARE denied boolean := false;
BEGIN
  BEGIN
    PERFORM 1 FROM public.marketing_provider_profiles;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'RC479_ANON_DIRECT_READ_SUCCEEDED'; END IF;
END;
$test$;
RESET ROLE;

-- Authenticated sessions retain their existing SELECT capability and RLS scope.
SET ROLE authenticated;
DO $test$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.marketing_provider_profiles;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'RC479_AUTHENTICATED_ACTIVE_PROFILE_READ_REGRESSED:%',visible_count;
  END IF;
END;
$test$;
RESET ROLE;

-- Trusted Edge Functions retain service-role reads, including RLS bypass.
SET ROLE service_role;
DO $test$
DECLARE visible_count integer;
BEGIN
  SELECT count(*) INTO visible_count FROM public.marketing_provider_profiles;
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'RC479_SERVICE_ROLE_READ_REGRESSED:%',visible_count;
  END IF;
END;
$test$;
RESET ROLE;

SELECT 'RC479 provider-profile anonymous read boundary: PASS' AS result;
