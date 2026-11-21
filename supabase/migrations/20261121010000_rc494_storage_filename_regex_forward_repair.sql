-- RC494: repair over-escaped Storage filename suffix predicates.
-- Preserve existing bucket boundaries and owner/platform-admin authorization scopes.
BEGIN;

DO $preflight$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(expected.policy_name)
    INTO v_missing
  FROM (VALUES
    ('mnty_platform_brand_insert'),
    ('mnty_platform_brand_update'),
    ('mnty_platform_brand_delete'),
    ('mnty_profile_media_owner_insert'),
    ('mnty_profile_media_owner_update')
  ) AS expected(policy_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname='storage'
      AND p.tablename='objects'
      AND p.policyname=expected.policy_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC494_EXPECTED_STORAGE_POLICIES_MISSING:%',v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_platform_brand_insert'
      AND cmd='INSERT' AND coalesce(with_check,'') ILIKE '%user_memberships%'
      AND coalesce(with_check,'') ILIKE '%SUPER_ADMIN%'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_insert'
      AND cmd='INSERT' AND coalesce(with_check,'') ILIKE '%owner_user_id%'
  ) THEN
    RAISE EXCEPTION 'RC494_STORAGE_AUTHORIZATION_PREDICATE_DRIFT';
  END IF;
END;
$preflight$;

DROP POLICY mnty_platform_brand_insert ON storage.objects;
CREATE POLICY mnty_platform_brand_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=auth.uid()
      AND m.status='ACTIVE'
      AND upper(m.role)='SUPER_ADMIN'
  )
);

DROP POLICY mnty_platform_brand_update ON storage.objects;
CREATE POLICY mnty_platform_brand_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=auth.uid()
      AND m.status='ACTIVE'
      AND upper(m.role)='SUPER_ADMIN'
  )
)
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=auth.uid()
      AND m.status='ACTIVE'
      AND upper(m.role)='SUPER_ADMIN'
  )
);

DROP POLICY mnty_platform_brand_delete ON storage.objects;
CREATE POLICY mnty_platform_brand_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=auth.uid()
      AND m.status='ACTIVE'
      AND upper(m.role)='SUPER_ADMIN'
  )
);

DROP POLICY mnty_profile_media_owner_insert ON storage.objects;
CREATE POLICY mnty_profile_media_owner_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
  AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

DROP POLICY mnty_profile_media_owner_update ON storage.objects;
CREATE POLICY mnty_profile_media_owner_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
)
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND split_part(name,'/',2)=auth.uid()::text
  AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$'
  AND EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

COMMENT ON POLICY mnty_platform_brand_insert ON storage.objects IS
  'RC494: platform branding uploads require an active SUPER_ADMIN membership and a valid image filename.';
COMMENT ON POLICY mnty_platform_brand_update ON storage.objects IS
  'RC494: platform branding updates require an active SUPER_ADMIN membership and a valid image filename.';
COMMENT ON POLICY mnty_platform_brand_delete ON storage.objects IS
  'RC494: platform branding deletion requires an active SUPER_ADMIN membership and a valid image filename.';
COMMENT ON POLICY mnty_profile_media_owner_insert ON storage.objects IS
  'RC494: provider profile media uploads require confirmed Auth, matching owner, and a valid image filename.';
COMMENT ON POLICY mnty_profile_media_owner_update ON storage.objects IS
  'RC494: provider profile media updates require matching owner and a valid image filename.';

COMMIT;
