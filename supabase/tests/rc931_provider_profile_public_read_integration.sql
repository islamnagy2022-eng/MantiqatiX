-- RC931: global provider-profile base-table read retirement.
-- Disposable PostgreSQL fixture only; every profile/business is synthetic.
DO $acl$
BEGIN
  IF has_table_privilege('anon','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC931_RAW_ANON_SELECT_STILL_GRANTED';
  END IF;
  IF NOT has_table_privilege('authenticated','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC931_AUTHENTICATED_SELECT_REMOVED';
  END IF;
  IF NOT has_table_privilege('service_role','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC931_SERVICE_ROLE_SELECT_REMOVED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public'
       AND tablename='marketing_provider_profiles'
       AND policyname='Public can view active marketing providers'
  ) THEN
    RAISE EXCEPTION 'RC931_GLOBAL_PUBLIC_PROVIDER_POLICY_REMAINS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public'
       AND tablename='marketing_provider_profiles'
       AND policyname='marketing_provider_profiles_confirmed_auth_select'
       AND permissive='RESTRICTIVE'
       AND cmd='SELECT'
       AND 'authenticated'=ANY(roles)
       AND qual ILIKE '%IS NOT DISTINCT FROM%'
  ) THEN
    RAISE EXCEPTION 'RC931_RC926_STRICT_IDENTITY_GUARD_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public'
       AND tablename='marketing_provider_profiles'
       AND policyname='Owners manage their marketing provider profile'
       AND cmd='ALL'
       AND 'authenticated'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'RC931_OWNER_POLICY_MISSING';
  END IF;
END;
$acl$;

-- Raw anon must not reach the base table even if the historical RLS policy is
-- accidentally reintroduced. RC479 owns this privilege boundary.
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
    RAISE EXCEPTION 'RC931_RAW_ANON_PROVIDER_READ_SUCCEEDED';
  END IF;
END;
$raw_anon$;
RESET ROLE;

-- A confirmed user without a business role or ownership cannot browse provider
-- base rows. Public discovery remains an Edge service-role projection.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000099","role":"authenticated","is_anonymous":false}', false);
DO $unrelated$
DECLARE visible integer;
BEGIN
  SELECT count(*) INTO visible FROM public.marketing_provider_profiles;
  IF visible <> 0 THEN
    RAISE EXCEPTION 'RC931_UNRELATED_CONFIRMED_USER_READ_PROVIDER_PROFILES:%', visible;
  END IF;
END;
$unrelated$;
RESET ROLE;

-- Business A manager sees only active profiles in Business A, not pending
-- onboarding rows, another business, or another tenant.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000011","role":"authenticated","is_anonymous":false}', false);
DO $manager_a$
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id='40000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'RC931_MANAGER_A_SCOPE_REGRESSED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id IN (
    '40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000006'
  )) THEN
    RAISE EXCEPTION 'RC931_MANAGER_A_CROSSED_BUSINESS_OR_TENANT';
  END IF;
END;
$manager_a$;
RESET ROLE;

-- Business B manager sees its own active provider only.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000013","role":"authenticated","is_anonymous":false}', false);
DO $manager_b$
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id='40000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'RC931_MANAGER_B_SCOPE_REGRESSED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id IN (
    '40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002'
  )) THEN
    RAISE EXCEPTION 'RC931_MANAGER_B_CROSSED_TENANT';
  END IF;
END;
$manager_b$;
RESET ROLE;

-- Tenant A ADMIN can review all provider states across businesses in its own
-- tenant, but cannot read any Tenant B row.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000012","role":"authenticated","is_anonymous":false}', false);
DO $tenant_admin$
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 4 THEN
    RAISE EXCEPTION 'RC931_TENANT_ADMIN_OWN_TENANT_READ_REGRESSED:%',
      (SELECT count(*) FROM public.marketing_provider_profiles);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id='40000000-0000-4000-8000-000000000002')
     OR NOT EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id='40000000-0000-4000-8000-000000000006') THEN
    RAISE EXCEPTION 'RC931_TENANT_ADMIN_PENDING_REVIEW_REGRESSED';
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id IN (
    '40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004'
  )) THEN
    RAISE EXCEPTION 'RC931_TENANT_ADMIN_CROSSED_TENANT';
  END IF;
END;
$tenant_admin$;
RESET ROLE;

-- Business OWNER role retains scoped CRM access in its own business.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000018","role":"authenticated","is_anonymous":false}', false);
DO $business_owner$
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 3 THEN
    RAISE EXCEPTION 'RC931_BUSINESS_OWNER_SCOPED_READ_REGRESSED:%',
      (SELECT count(*) FROM public.marketing_provider_profiles);
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id IN (
    '40000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000004'
  )) THEN
    RAISE EXCEPTION 'RC931_BUSINESS_OWNER_CROSSED_TENANT';
  END IF;
END;
$business_owner$;
RESET ROLE;

-- Profile owner keeps their own active/pending profile rows and owner UPDATE.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000016","role":"authenticated","is_anonymous":false}', false);
DO $profile_owner$
DECLARE affected integer;
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 2 THEN
    RAISE EXCEPTION 'RC931_PROFILE_OWNER_READ_REGRESSED:%',
      (SELECT count(*) FROM public.marketing_provider_profiles);
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id='40000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'RC931_PROFILE_OWNER_READ_ANOTHER_ONBOARDING_ROW';
  END IF;
  UPDATE public.marketing_provider_profiles
     SET settings=jsonb_set(settings,'{rc931_owner_update}','true'::jsonb,true)
   WHERE id='40000000-0000-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'RC931_PROFILE_OWNER_UPDATE_REGRESSED:%', affected;
  END IF;
END;
$profile_owner$;
RESET ROLE;

-- Only explicit platform-root scope sees every profile. A tenant SUPER_ADMIN
-- is not a platform administrator merely because of its tenant-local role.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000014","role":"authenticated","is_anonymous":false}', false);
DO $tenant_super$
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 2 THEN
    RAISE EXCEPTION 'RC931_TENANT_SUPER_ADMIN_LOCAL_SCOPE_REGRESSED:%',
      (SELECT count(*) FROM public.marketing_provider_profiles);
  END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles WHERE id IN (
    '40000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000006'
  )) THEN
    RAISE EXCEPTION 'RC931_TENANT_SUPER_ADMIN_GAINED_CROSS_TENANT_READ';
  END IF;
END;
$tenant_super$;
RESET ROLE;

-- An MNTY-PLATFORM membership and full_control metadata are not platform-root
-- authority unless the user is present in private.platform_admins.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000020","role":"authenticated","is_anonymous":false}', false);
DO $unregistered_platform$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles) THEN
    RAISE EXCEPTION 'RC931_UNREGISTERED_MNTY_PLATFORM_MEMBERSHIP_GAINED_GLOBAL_READ';
  END IF;
END;
$unregistered_platform$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000015","role":"authenticated","is_anonymous":false}', false);
DO $platform_admin$
BEGIN
  IF (SELECT count(*) FROM public.marketing_provider_profiles) <> 6 THEN
    RAISE EXCEPTION 'RC931_PLATFORM_ADMIN_GLOBAL_READ_REGRESSED:%',
      (SELECT count(*) FROM public.marketing_provider_profiles);
  END IF;
END;
$platform_admin$;
RESET ROLE;

-- RC926's RESTRICTIVE policy rejects both Anonymous Auth and missing/null
-- is_anonymous claims even though these callers use the authenticated role.
SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000011","role":"authenticated","is_anonymous":true}', false);
DO $anonymous_auth$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles) THEN
    RAISE EXCEPTION 'RC931_ANONYMOUS_AUTH_PROVIDER_READ_SUCCEEDED';
  END IF;
END;
$anonymous_auth$;
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000011","role":"authenticated"}', false);
DO $missing_claim$
BEGIN
  IF EXISTS (SELECT 1 FROM public.marketing_provider_profiles) THEN
    RAISE EXCEPTION 'RC931_MISSING_ANONYMOUS_CLAIM_PROVIDER_READ_SUCCEEDED';
  END IF;
END;
$missing_claim$;
RESET ROLE;

-- Trusted Edge Functions retain the curated server-side path. service_role
-- bypasses RLS but clients still receive only the Edge allowlisted projection.
SET ROLE service_role;
DO $service_role$
DECLARE visible integer; active_public integer;
BEGIN
  SELECT count(*) INTO visible FROM public.marketing_provider_profiles;
  IF visible <> 6 THEN
    RAISE EXCEPTION 'RC931_SERVICE_ROLE_READ_REGRESSED:%', visible;
  END IF;
  SELECT count(*) INTO active_public FROM (
    SELECT business_id,name_ar,provider_kind,description,slug,status,is_verified,is_featured
    FROM public.marketing_provider_profiles
    WHERE status='ACTIVE'
  ) approved_projection;
  IF active_public <> 2 THEN
    RAISE EXCEPTION 'RC931_SERVICE_ROLE_PUBLIC_PROJECTION_SOURCE_REGRESSED:%', active_public;
  END IF;
END;
$service_role$;
RESET ROLE;

SELECT 'RC931 global provider-profile read retirement: PASS' AS result;
