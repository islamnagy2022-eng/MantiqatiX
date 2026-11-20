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

  INSERT INTO public.user_memberships(id,user_id,status,role)
  VALUES
    ('RC488-ANON-ADMIN',v_anon,'ACTIVE','SUPER_ADMIN'),
    ('RC488-CONFIRMED-ADMIN',v_owner,'ACTIVE','SUPER_ADMIN');

  INSERT INTO public.marketing_provider_profiles
    (id,provider_kind,owner_user_id,name_ar,slug,status)
  VALUES
    (v_anon_profile,'FREELANCER',v_anon,'RC488 anonymous fixture','rc488-anon-fixture','ACTIVE'),
    (v_owner_profile,'FREELANCER',v_owner,'RC488 confirmed fixture','rc488-owner-fixture','ACTIVE');

  INSERT INTO storage.objects(id,bucket_id,name,owner,owner_id,metadata,path_tokens)
  VALUES
    ('48800000-0000-4000-8000-000000000101','mantiqatix-profile-media',
      'users/'||v_anon::text||'/providers/'||v_anon_profile::text||'/cover.jpg',
      v_anon,v_anon::text,'{"mimetype":"image/jpeg","size":10}'::jsonb,
      ARRAY['users',v_anon::text,'providers',v_anon_profile::text,'cover.jpg']),
    ('48800000-0000-4000-8000-000000000102','mantiqatix-profile-media',
      'users/'||v_owner::text||'/providers/'||v_owner_profile::text||'/cover.jpg',
      v_owner,v_owner::text,'{"mimetype":"image/jpeg","size":10}'::jsonb,
      ARRAY['users',v_owner::text,'providers',v_owner_profile::text,'cover.jpg']),
    ('48800000-0000-4000-8000-000000000103','mantiqatix-media',
      'users/'||v_anon::text||'/private-fixture.jpg',
      v_anon,v_anon::text,'{"mimetype":"image/jpeg","size":10}'::jsonb,
      ARRAY['users',v_anon::text,'private-fixture.jpg']);
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

  DELETE FROM storage.objects WHERE id='48800000-0000-4000-8000-000000000101';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'RC488_ANONYMOUS_PROFILE_MEDIA_DELETE_SUCCEEDED:%',n; END IF;

  denied:=false;
  BEGIN
    INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata,path_tokens)
    VALUES ('mantiqatix-profile-media',
      'platform/branding/logo-999.jpg',
      '48800000-0000-4000-8000-000000000001'::uuid,
      '48800000-0000-4000-8000-000000000001',
      '{"mimetype":"image/jpeg","size":10}'::jsonb,
      ARRAY['platform','branding','logo-999.jpg']);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    denied:=true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'RC488_ANONYMOUS_PLATFORM_BRAND_INSERT_SUCCEEDED'; END IF;
END;
$anonymous_write$;
RESET ROLE;

-- A confirmed owner retains the intended profile-media update and delete flow.
SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48800000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed_owner$
DECLARE n integer;
BEGIN
  UPDATE storage.objects SET metadata=jsonb_set(metadata,'{rc488}','true'::jsonb,true)
  WHERE id='48800000-0000-4000-8000-000000000102';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'RC488_CONFIRMED_OWNER_UPDATE_REGRESSED:%',n; END IF;

  DELETE FROM storage.objects WHERE id='48800000-0000-4000-8000-000000000102';
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'RC488_CONFIRMED_OWNER_DELETE_REGRESSED:%',n; END IF;

  INSERT INTO storage.objects(bucket_id,name,owner,owner_id,metadata,path_tokens)
  VALUES ('mantiqatix-profile-media','platform/branding/logo-998.jpg',
    '48800000-0000-4000-8000-000000000002'::uuid,
    '48800000-0000-4000-8000-000000000002',
    '{"mimetype":"image/jpeg","size":10}'::jsonb,
    ARRAY['platform','branding','logo-998.jpg']);
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
