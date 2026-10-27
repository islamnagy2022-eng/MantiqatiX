-- Runtime integration contract for the owner profile RPC.
-- This file is executed only by the isolated forward-migration replay workflow.
-- All fixture writes are rolled back before the test finishes.
BEGIN;

DO $test$
DECLARE
  v_tenant_id varchar := 'MNTY-PLATFORM';
  v_business_id uuid;
  v_branch_id varchar := 'MNTY-HOMEWARES-QADAM-ALSAAD-MAIN';
  v_owner_id uuid := 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b';
  v_manager_id uuid := 'a631baef-8347-4dd2-a8c5-6d5b5e3e0f44';
  v_provider_id uuid;
  v_result jsonb;
  v_settings jsonb;
  v_error text;
BEGIN
  SELECT b.id INTO v_business_id
    FROM public.businesses b
   WHERE b.tenant_id = v_tenant_id
     AND b.code = 'MNTY-HOMEWARES-QADAM-ALSAAD'
     AND upper(b.status) = 'ACTIVE'
   LIMIT 1;

  IF v_business_id IS NULL THEN
    RAISE EXCEPTION 'OWNER_PROFILE_TEST_BUSINESS_FIXTURE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches br
     WHERE br.id = v_branch_id AND br.business_id = v_business_id
       AND br.tenant_id = v_tenant_id AND upper(br.status) = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'OWNER_PROFILE_TEST_BRANCH_FIXTURE_MISSING';
  END IF;

  INSERT INTO auth.users
    (id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     is_sso_user, is_anonymous)
  VALUES
    (v_manager_id, 'authenticated', 'authenticated',
     'owner-profile-manager-fixture@example.invalid', '',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"test_fixture":true}'::jsonb, now(), now(), false, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_memberships
    (id, user_id, tenant_id, business_id, branch_id, role, permissions, status)
  VALUES
    ('OWNER-PROFILE-TEST-OWNER', v_owner_id, v_tenant_id, v_business_id,
     NULL, 'OWNER', '["*"]'::jsonb, 'ACTIVE'),
    ('OWNER-PROFILE-TEST-MANAGER', v_manager_id, v_tenant_id, v_business_id,
     v_branch_id, 'MANAGER', '[]'::jsonb, 'ACTIVE')
  ON CONFLICT DO UPDATE
    SET role = EXCLUDED.role,
        permissions = EXCLUDED.permissions,
        status = EXCLUDED.status;

  INSERT INTO public.marketing_provider_profiles
    (provider_kind, business_id, owner_user_id, name_ar, slug, status)
  VALUES
    ('OFFICIAL', v_business_id, v_owner_id,
     'Owner Profile Test', 'owner-profile-persistence-integration-test', 'ACTIVE')
  RETURNING id INTO v_provider_id;

  UPDATE public.businesses
     SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
       'catalog_public_enabled', true,
       'catalog_profile', jsonb_build_object(
         'google_maps_url', 'https://maps.google.com/?q=owner-profile-test',
         'custom_preserved_key', 'keep-me',
         'bio', 'before'
       )
     )
   WHERE id = v_business_id AND tenant_id = v_tenant_id;

  PERFORM set_config('request.jwt.claim.sub', v_owner_id::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_owner_id::text, 'role', 'authenticated', 'is_anonymous', false)::text,
    true);

  v_result := public.upsert_catalog_business_profile_backend(
    v_tenant_id, v_business_id, v_branch_id,
    'Owner Profile Test Updated', 'updated bio', '+201000000000',
    'Test Street', 'Test Governorate', 'Test Markaz', 'Test District',
    'Sun-Thu 9:00-17:00', '', '', false
  );

  IF v_result->>'success' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'OWNER_PROFILE_RPC_DID_NOT_SUCCEED: %', v_result;
  END IF;
  IF v_result->'publicEnabled' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'OWNER_PROFILE_RPC_RETURNED_STALE_PUBLICATION_STATE: %', v_result;
  END IF;

  SELECT settings INTO v_settings
    FROM public.businesses WHERE id = v_business_id AND tenant_id = v_tenant_id;

  IF v_settings->'catalog_public_enabled' IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'OWNER_PROFILE_RPC_CHANGED_PUBLICATION_STATE';
  END IF;
  IF v_settings->'catalog_profile'->>'google_maps_url' IS DISTINCT FROM 'https://maps.google.com/?q=owner-profile-test'
     OR v_settings->'catalog_profile'->>'custom_preserved_key' IS DISTINCT FROM 'keep-me'
     OR v_settings->'catalog_profile'->>'bio' IS DISTINCT FROM 'updated bio' THEN
    RAISE EXCEPTION 'OWNER_PROFILE_RPC_FAILED_TO_MERGE_PROFILE_METADATA: %', v_settings->'catalog_profile';
  END IF;

  -- A branch-scoped manager must not update the business-wide profile.
  PERFORM set_config('request.jwt.claim.sub', v_manager_id::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', v_manager_id::text, 'role', 'authenticated', 'is_anonymous', false)::text,
    true);

  BEGIN
    PERFORM public.upsert_catalog_business_profile_backend(
      v_tenant_id, v_business_id, v_branch_id,
      'Unauthorized Manager Edit', 'should be denied', '+201000000000',
      'Test Street', 'Test Governorate', 'Test Markaz', 'Test District',
      'Sun-Thu 9:00-17:00', '', '', false
    );
    RAISE EXCEPTION 'OWNER_PROFILE_BRANCH_MANAGER_WRITE_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error = 'OWNER_PROFILE_BRANCH_MANAGER_WRITE_WAS_ALLOWED' THEN
      RAISE;
    END IF;
    IF v_error NOT LIKE '%CATALOG_PROFILE_WRITE_FORBIDDEN%' THEN
      RAISE EXCEPTION 'OWNER_PROFILE_EXPECTED_MANAGER_DENIAL_BUT_GOT: %', v_error;
    END IF;
  END;

  RAISE NOTICE 'PASS: owner profile merge preserves metadata and publication state; branch manager is denied';
END
$test$;

ROLLBACK;
