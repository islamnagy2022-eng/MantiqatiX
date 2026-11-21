-- RC488 disposable integration test. Run only in isolated PostgreSQL replay.
-- Synthetic provider profiles and Storage metadata rows are rolled back.
BEGIN;

INSERT INTO auth.users
  (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
VALUES
  ('48800000-0000-4000-8000-000000000001','authenticated','authenticated','rc488-anon@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc488_fixture":true}'::jsonb,now(),now(),false,true),
  ('48800000-0000-4000-8000-000000000002','authenticated','authenticated','rc488-owner@example.invalid','',now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"rc488_fixture":true}'::jsonb,now(),now(),false,false)
ON CONFLICT (id) DO NOTHING;

DO $fixture$
DECLARE
  v_anon uuid := '48800000-0000-4000-8000-000000000001';
  v_owner uuid := '48800000-0000-4000-8000-000000000002';
  v_anon_profile uuid := '48800000-0000-4000-8000-000000000011';
  v_owner_profile uuid := '48800000-0000-4000-8000-000000000012';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='mantiqatix-profile-media') THEN
    RAISE EXCEPTION 'RC488_PROFILE_MEDIA_BUCKET_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='mantiqatix-media') THEN
    RAISE EXCEPTION 'RC488_PRIVATE_MEDIA_BUCKET_MISSING';
  END IF;

  INSERT INTO public.user_memberships(id,user_id,tenant_id,status,role)
  VALUES
    ('RC488-ANON-ADMIN',v_anon,'MNTY-PLATFORM','ACTIVE','SUPER_ADMIN'),
    ('RC488-CONFIRMED-ADMIN',v_owner,'MNTY-PLATFORM','ACTIVE','SUPER_ADMIN');

  -- RC484 makes the private registry authoritative; legacy SUPER_ADMIN
  -- membership alone must not be treated as platform-root authority.
  INSERT INTO private.platform_admins(user_id)
  VALUES (v_owner)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.marketing_provider_profiles
    (id,provider_kind,owner_user_id,name_ar,slug,status)
  VALUES
    (v_anon_profile,'FREELANCER',v_anon,'RC488 anonymous fixture','rc488-anon-fixture','ACTIVE'),
    (v_owner_profile,'FREELANCER',v_owner,'RC488 confirmed fixture','rc488-owner-fixture','ACTIVE');

  INSERT INTO storage.objects(id,bucket_id,name,owner,owner_id,metadata)
  VALUES
    ('48800000-0000-4000-8000-000000000101','mantiqatix-profile-media',
      'users/'||v_anon::text||'/providers/'||v_anon_profile::text||'/cover.jpg',
      v_anon,v_anon::text,'{"mimetype":"image/jpeg","size":10}'::jsonb),
    ('48800000-0000-4000-8000-000000000102','mantiqatix-profile-media',
      'users/'||v_owner::text||'/providers/'||v_owner_profile::text||'/cover.jpg',
      v_owner,v_owner::text,'{"mimetype":"image/jpeg","size":10}'::jsonb),
    ('48800000-0000-4000-8000-000000000103','mantiqatix-media',
      'users/'||v_anon::text||'/private-fixture.jpg',
      v_anon,v_anon::text,'{"mimetype":"image/jpeg","size":10}'::jsonb);
END;
$fixture$;

-- Anonymous Auth remains able to SELECT intentionally public provider media.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48800000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous_read$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
  WHERE id='48800000-0000-4000-8000-000000000101';
  IF n <> 1 THEN
    RAISE EXCEPTION 'RC488_PUBLIC_PROFILE_MEDIA_READ_REGRESSED:%',n;
  END IF;

  SELECT count(*) INTO n FROM storage.objects
  WHERE id='48800000-0000-4000-8000-000000000103';
  IF n <> 0 THEN
    RAISE EXCEPTION 'RC488_ANONYMOUS_PRIVATE_MEDIA_READ_SUCCEEDED:%',n;
  END IF;
END;
$anonymous_read$;

DO $anonymous_write$
DECLARE n integer; denied boolean;
BEGIN
  UPDATE storage.objects SET metadata=jsonb_set(metadata,'{rc488}','true'::jsonb,true)
  WHERE id='48800000-0000-4000-8000-000000000101';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'RC488_ANONYMOUS_PROFILE_MEDIA_UPDATE_SUCCEEDED:%',n; END IF;

  -- The real Supabase Storage schema blocks direct SQL DELETE before RLS.
  -- In its disposable full-schema replay, verify the restrictive DELETE policy;
  -- the isolated RC488 fixture has no Storage API trigger and tests actual DELETE.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='storage.objects'::regclass
      AND tgname='protect_objects_delete'
      AND NOT tgisinternal
  ) THEN
    DELETE FROM storage.objects WHERE id='48800000-0000-4000-8000-000000000101';
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'RC488_ANONYMOUS_PROFILE_MEDIA_DELETE_SUCCEEDED:%',n; END IF;
  END IF;

  SELECT count(*) INTO n
  FROM pg_catalog.pg_policies
  WHERE schemaname='storage'
    AND tablename='objects'
    AND policyname='storage_objects_confirmed_auth_delete'
    AND cmd='DELETE'
    AND permissive='RESTRICTIVE'
    AND roles @> ARRAY['authenticated']::name[]
    AND coalesce(qual,'') ILIKE '%is_anonymous%';
  IF n <> 1 THEN RAISE EXCEPTION 'RC488_RESTRICTIVE_DELETE_POLICY_MISSING:%',n; END IF;

  denied:=false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
    VALUES ('mantiqatix-profile-media',
      'platform/branding/logo-999.jpg',
      '48800000-0000-4000-8000-000000000001'::uuid,
      '48800000-0000-4000-8000-000000000001',
      '{"mimetype":"image/jpeg","size":10}'::jsonb);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'RC488_ANONYMOUS_PLATFORM_BRAND_INSERT_SUCCEEDED'; END IF;
END;
$anonymous_write$;

-- Missing identity classification must not authorize Storage writes.
SELECT pg_catalog.set_config('request.jwt.claims',
  '{"sub":"48800000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $missing_claim_write$
DECLARE n integer;
BEGIN
  UPDATE storage.objects SET metadata=jsonb_set(metadata,'{rc488_missing_claim}','true'::jsonb,true)
  WHERE id='48800000-0000-4000-8000-000000000101';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'RC488_MISSING_ANONYMOUS_CLAIM_WRITE_SUCCEEDED:%',n; END IF;
END;
$missing_claim_write$;
RESET ROLE;
-- A confirmed owner retains the intended profile-media update and delete flow.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48800000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed_owner$
DECLARE
  n integer;
  v_auth_uid uuid;
  v_path text;
  v_profile_owner uuid;
  v_profile_visible boolean;
  v_anon text;
  v_path_matches boolean;
BEGIN
  v_auth_uid := auth.uid();
  v_anon := auth.jwt()->>'is_anonymous';
  SELECT name INTO v_path FROM storage.objects
  WHERE id='48800000-0000-4000-8000-000000000102';
  SELECT owner_user_id INTO v_profile_owner
  FROM public.marketing_provider_profiles
  WHERE id='48800000-0000-4000-8000-000000000012';
  SELECT EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles
    WHERE id='48800000-0000-4000-8000-000000000012'
      AND owner_user_id=v_auth_uid
  ) INTO v_profile_visible;
  v_path_matches := v_path ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$';
  RAISE NOTICE 'RC488_OWNER_UPDATE_DIAGNOSTIC auth_uid=% path_user=% profile_owner=% is_anonymous=% path_matches=% profile_visible=%',
    v_auth_uid, split_part(v_path,'/',2), v_profile_owner, v_anon, v_path_matches, v_profile_visible;

  UPDATE storage.objects SET metadata=jsonb_set(metadata,'{rc488}','true'::jsonb,true)
  WHERE id='48800000-0000-4000-8000-000000000102';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'RC488_CONFIRMED_OWNER_UPDATE_REGRESSED:%',n; END IF;

  -- Direct SQL DELETE is blocked by the real Storage trigger. Exercise actual
  -- DELETE RLS semantics only in the isolated fixture without that trigger.
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='storage.objects'::regclass
      AND tgname='protect_objects_delete'
      AND NOT tgisinternal
  ) THEN
    DELETE FROM storage.objects WHERE id='48800000-0000-4000-8000-000000000102';
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n <> 1 THEN RAISE EXCEPTION 'RC488_CONFIRMED_OWNER_DELETE_REGRESSED:%',n; END IF;
  END IF;

  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata)
  VALUES ('mantiqatix-profile-media','platform/branding/logo-998.jpg',
    '48800000-0000-4000-8000-000000000002'::uuid,
    '48800000-0000-4000-8000-000000000002',
    '{"mimetype":"image/jpeg","size":10}'::jsonb);
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'RC488_CONFIRMED_ADMIN_INSERT_REGRESSED:%',n; END IF;
END;
$confirmed_owner$;
RESET ROLE;

-- Public role still reads public profile media, while private bucket remains unavailable.
SET LOCAL ROLE anon;
DO $raw_anon$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM storage.objects
  WHERE id='48800000-0000-4000-8000-000000000101';
  IF n <> 1 THEN RAISE EXCEPTION 'RC488_RAW_ANON_PUBLIC_PROFILE_READ_REGRESSED:%',n; END IF;
END;
$raw_anon$;
RESET ROLE;

ROLLBACK;
SELECT 'RC488 Storage anonymous Auth write isolation: PASS' AS result;
