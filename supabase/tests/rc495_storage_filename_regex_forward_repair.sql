-- RC495 regression coverage for corrected Storage filename suffix predicates and registry authority.
DO $rc495$
DECLARE
  v_expr text;
BEGIN
  IF 'platform/branding/logo-998.jpg' !~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
     OR 'platform/branding/mark-12.svg' !~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
     OR 'platform/branding/logo-998.exe' ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$' THEN
    RAISE EXCEPTION 'RC495_PLATFORM_BRAND_FILENAME_REGEX_REGRESSED';
  END IF;

  IF 'users/48800000-0000-4000-8000-000000000002/providers/48800000-0000-4000-8000-000000000012/logo.jpg' !~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$'
     OR 'users/48800000-0000-4000-8000-000000000002/providers/48800000-0000-4000-8000-000000000012/cover.webp' !~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$'
     OR 'users/48800000-0000-4000-8000-000000000002/providers/48800000-0000-4000-8000-000000000012/logo.svg' ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$' THEN
    RAISE EXCEPTION 'RC495_PROVIDER_PROFILE_FILENAME_REGEX_REGRESSED';
  END IF;

  SELECT with_check INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_platform_brand_insert';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%mnty_can_platform_admin%'
     OR v_expr ILIKE '%user_memberships%' OR v_expr NOT LIKE '%[.]%'
     OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PLATFORM_BRAND_INSERT_REGISTRY_OR_REGEX_REGRESSED';
  END IF;

  SELECT qual INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_platform_brand_update';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%mnty_can_platform_admin%'
     OR v_expr ILIKE '%user_memberships%' OR v_expr NOT LIKE '%[.]%'
     OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PLATFORM_BRAND_UPDATE_USING_REGRESSED';
  END IF;

  SELECT with_check INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_platform_brand_update';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%mnty_can_platform_admin%'
     OR v_expr ILIKE '%user_memberships%' OR v_expr NOT LIKE '%[.]%'
     OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PLATFORM_BRAND_UPDATE_CHECK_REGRESSED';
  END IF;

  SELECT qual INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_platform_brand_delete';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%mnty_can_platform_admin%'
     OR v_expr ILIKE '%user_memberships%' OR v_expr NOT LIKE '%[.]%'
     OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PLATFORM_BRAND_DELETE_REGISTRY_OR_REGEX_REGRESSED';
  END IF;

  SELECT with_check INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_profile_media_owner_insert';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%owner_user_id%' OR v_expr NOT ILIKE '%is_anonymous%'
     OR v_expr NOT LIKE '%[.]%' OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PROFILE_MEDIA_OWNER_INSERT_REGEX_OR_AUTH_REGRESSED';
  END IF;

  SELECT qual INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_profile_media_owner_update';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%owner_user_id%' OR v_expr NOT ILIKE '%is_anonymous%'
     OR v_expr NOT LIKE '%[.]%' OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PROFILE_MEDIA_OWNER_UPDATE_SCOPE_REGRESSED';
  END IF;

  SELECT with_check INTO v_expr FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects' AND policyname='mnty_profile_media_owner_update';
  IF v_expr IS NULL OR v_expr NOT ILIKE '%owner_user_id%' OR v_expr NOT ILIKE '%is_anonymous%'
     OR v_expr NOT LIKE '%[.]%' OR position(repeat(chr(92),2)||'.' in v_expr)>0 THEN
    RAISE EXCEPTION 'RC495_PROFILE_MEDIA_OWNER_UPDATE_REGEX_OR_AUTH_REGRESSED';
  END IF;
END;
$rc495$;
