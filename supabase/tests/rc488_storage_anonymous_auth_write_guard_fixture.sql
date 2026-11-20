-- Disposable RC488 fixture. Recreates only the Storage/profile policy contract under test.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA storage;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$function$;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $function$
  SELECT nullif(auth.jwt()->>'sub','')::uuid
$function$;

CREATE TABLE auth.users(
  id uuid PRIMARY KEY,
  aud text NOT NULL,
  role text NOT NULL,
  email text UNIQUE,
  encrypted_password text NOT NULL DEFAULT '',
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_sso_user boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false
);

CREATE TABLE public.user_memberships(
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  status text NOT NULL,
  role text NOT NULL
);

CREATE TABLE public.marketing_provider_profiles(
  id uuid PRIMARY KEY,
  provider_kind varchar NOT NULL CHECK(provider_kind IN ('OFFICIAL','PARTNER_COMPANY','FREELANCER')),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name_ar varchar NOT NULL,
  slug varchar NOT NULL UNIQUE,
  status varchar NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','ACTIVE','SUSPENDED','INACTIVE')),
  specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  service_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  portfolio jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  ranking_weight numeric NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_provider_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY marketing_provider_profiles_public_active_read
ON public.marketing_provider_profiles FOR SELECT TO anon,authenticated
USING(status='ACTIVE');
GRANT SELECT ON public.marketing_provider_profiles TO anon,authenticated;

CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false);
INSERT INTO storage.buckets(id,name,public) VALUES
 ('mantiqatix-profile-media','mantiqatix-profile-media',true),
 ('mantiqatix-media','mantiqatix-media',false);

CREATE TABLE storage.objects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY mnty_profile_media_public_read
ON storage.objects FOR SELECT TO public
USING(bucket_id='mantiqatix-profile-media');

CREATE POLICY mnty_profile_media_owner_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='mantiqatix-profile-media'
  AND coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)\.(jpg|jpeg|png|webp)$'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

CREATE POLICY mnty_platform_brand_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+\\.(jpg|jpeg|png|webp|svg) TO authenticated
USING(
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
)
WITH CHECK(
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)\.(jpg|jpeg|png|webp)$'
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

CREATE POLICY mnty_profile_media_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING(
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

CREATE POLICY mantiqatix_media_authenticated_read
ON storage.objects FOR SELECT TO authenticated
USING(
  bucket_id='mantiqatix-media'
  AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
  AND (owner_id=auth.uid()::text OR name LIKE 'users/'||auth.uid()::text||'/%')
);

GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
GRANT SELECT ON storage.buckets TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon,service_role;
GRANT INSERT,UPDATE,DELETE ON storage.objects TO service_role;
GRANT SELECT ON public.marketing_provider_profiles TO authenticated,service_role;
GRANT INSERT,UPDATE,DELETE ON public.marketing_provider_profiles TO service_role;

  AND EXISTS(
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=auth.uid() AND m.status='ACTIVE' AND upper(m.role)='SUPER_ADMIN'
  )
);

CREATE POLICY mnty_profile_media_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING(
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
)
WITH CHECK(
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)\.(jpg|jpeg|png|webp)$'
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

CREATE POLICY mnty_profile_media_owner_delete
ON storage.objects FOR DELETE TO authenticated
USING(
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS(
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

CREATE POLICY mantiqatix_media_authenticated_read
ON storage.objects FOR SELECT TO authenticated
USING(
  bucket_id='mantiqatix-media'
  AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
  AND (owner_id=auth.uid()::text OR name LIKE 'users/'||auth.uid()::text||'/%')
);

GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
GRANT SELECT ON storage.buckets TO anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon,service_role;
GRANT INSERT,UPDATE,DELETE ON storage.objects TO service_role;
GRANT SELECT ON public.marketing_provider_profiles TO authenticated,service_role;
GRANT INSERT,UPDATE,DELETE ON public.marketing_provider_profiles TO service_role;
