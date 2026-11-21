-- RC495: repair Storage filename suffix predicates and bind platform branding to the canonical root registry.
-- Preserve bucket boundaries, owner checks and RC488 confirmed-Auth restrictions.
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
    RAISE EXCEPTION 'RC495_EXPECTED_STORAGE_POLICIES_MISSING:%',v_missing;
  END IF;

  IF pg_catalog.to_regprocedure('public.mnty_can_platform_admin()') IS NULL THEN
    RAISE EXCEPTION 'RC495_PLATFORM_ADMIN_REGISTRY_GUARD_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_platform_brand_insert'
      AND cmd='INSERT' AND 'authenticated'=ANY(roles)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_insert'
      AND cmd='INSERT' AND coalesce(with_check,'') ILIKE '%owner_user_id%'
  ) THEN
    RAISE EXCEPTION 'RC495_STORAGE_POLICY_COMMAND_OR_OWNER_SCOPE_DRIFT';
  END IF;
END;
$preflight$;

DROP POLICY mnty_platform_brand_insert ON storage.objects;
CREATE POLICY mnty_platform_brand_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND public.mnty_can_platform_admin()
);

DROP POLICY mnty_platform_brand_update ON storage.objects;
CREATE POLICY mnty_platform_brand_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND public.mnty_can_platform_admin()
)
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND public.mnty_can_platform_admin()
);

DROP POLICY mnty_platform_brand_delete ON storage.objects;
CREATE POLICY mnty_platform_brand_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id='mantiqatix-profile-media'
  AND name ~ '^platform/branding/(logo|mark)-[0-9]+[.](jpg|jpeg|png|webp|svg)$'
  AND public.mnty_can_platform_admin()
);

DROP POLICY mnty_profile_media_owner_insert ON storage.objects;
CREATE POLICY mnty_profile_media_owner_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
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
  AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
)
WITH CHECK (
  bucket_id='mantiqatix-profile-media'
  AND (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
  AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)[.](jpg|jpeg|png|webp)$'
  AND split_part(name,'/',2)=auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.marketing_provider_profiles p
    WHERE p.id=(split_part(objects.name,'/',4))::uuid
      AND p.owner_user_id=auth.uid()
  )
);

COMMENT ON POLICY mnty_platform_brand_insert ON storage.objects IS
  'RC495: platform branding uploads require canonical private-registry platform-root authority and a valid image filename.';
COMMENT ON POLICY mnty_platform_brand_update ON storage.objects IS
  'RC495: platform branding updates require canonical private-registry platform-root authority and a valid image filename.';
COMMENT ON POLICY mnty_platform_brand_delete ON storage.objects IS
  'RC495: platform branding deletion requires canonical private-registry platform-root authority and a valid image filename.';
COMMENT ON POLICY mnty_profile_media_owner_insert ON storage.objects IS
  'RC495: provider profile media uploads require confirmed Auth, matching owner, and a valid image filename.';
COMMENT ON POLICY mnty_profile_media_owner_update ON storage.objects IS
  'RC495: provider profile media updates require confirmed Auth, matching owner, and a valid image filename.';

COMMIT;
