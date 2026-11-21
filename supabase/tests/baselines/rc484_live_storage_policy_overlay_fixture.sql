-- TEST-ONLY overlay for forward replay from the captured Production schema checkpoint.
-- Production has this storage policy; the checkpoint omits it. Recreate only the
-- policy metadata needed to make the RC484 global-helper blast-radius preflight exact.
-- Never apply this fixture to Production or any shared database.
DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('storage.objects') IS NULL
     OR pg_catalog.to_regclass('public.indrive_requests') IS NULL
     OR pg_catalog.to_regclass('public.indrive_bids') IS NULL THEN
    RAISE EXCEPTION 'RC484_STORAGE_POLICY_OVERLAY_REQUIRED_OBJECT_MISSING';
  END IF;
END
$preflight$;

DO $overlay$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='mantiqatix_media_maintenance_provider_read'
  ) THEN
    CREATE POLICY mantiqatix_media_maintenance_provider_read
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id='mantiqatix-media'
      AND coalesce(auth.jwt()->>'is_anonymous','false')<>'true'
      AND name LIKE 'users/%/maintenance/%'
      AND EXISTS (
        SELECT 1
        FROM public.indrive_requests r
        WHERE r.attachment_path=objects.name
          AND (
            r.owner_user_id=auth.uid()
            OR EXISTS (
              SELECT 1
              FROM public.indrive_bids b
              WHERE b.request_id=r.id
                AND b.provider_user_id=auth.uid()
                AND b.status IN ('OFFERED','ACCEPTED')
            )
            OR public.is_platform_admin()
          )
      )
    );
  END IF;
END
$overlay$;

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='mantiqatix_media_maintenance_provider_read'
      AND cmd='SELECT'
      AND 'authenticated'=ANY(roles)
      AND coalesce(qual,'') ILIKE '%is_platform_admin()%'
  ) THEN
    RAISE EXCEPTION 'RC484_STORAGE_POLICY_OVERLAY_NOT_RESTORED';
  END IF;
END
$verify$;

SELECT 'TEST_ONLY_RC484_STORAGE_POLICY_OVERLAY=PASS' AS result;

-- The captured checkpoint also omits Storage bucket rows and the known Production
-- profile-media policy set. Restore them only in this disposable replay so RC488
-- can verify that its restrictive policies preserve the real owner/public-media contract.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES
  ('mantiqatix-profile-media','mantiqatix-profile-media',true,5242880,ARRAY['image/jpeg','image/png','image/webp']),
  ('mantiqatix-media','mantiqatix-media',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public=EXCLUDED.public,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;

DO $profile_media_overlay$
BEGIN
  IF pg_catalog.to_regclass('storage.objects') IS NULL
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='mantiqatix-profile-media') THEN
    RAISE EXCEPTION 'RC484_PROFILE_MEDIA_STORAGE_PREREQUISITE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_public_read'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_profile_media_public_read
      ON storage.objects FOR SELECT TO public
      USING (bucket_id='mantiqatix-profile-media')
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_profile_media_owner_insert
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id='mantiqatix-profile-media'
        AND coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
        AND name ~ '^users/[0-9a-fA-F-]{36}/providers/[0-9a-fA-F-]{36}/(cover|logo)\\.(jpg|jpeg|png|webp)$'
        AND split_part(name,'/',2)=auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.marketing_provider_profiles p
          WHERE p.id=(split_part(name,'/',4))::uuid
            AND p.owner_user_id=auth.uid()
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_profile_media_owner_update
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id='mantiqatix-profile-media'
        AND split_part(name,'/',2)=auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.marketing_provider_profiles p
          WHERE p.id=(split_part(name,'/',4))::uuid
            AND p.owner_user_id=auth.uid()
        )
      )
      WITH CHECK (
        bucket_id='mantiqatix-profile-media'
        AND split_part(name,'/',2)=auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.marketing_provider_profiles p
          WHERE p.id=(split_part(name,'/',4))::uuid
            AND p.owner_user_id=auth.uid()
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_profile_media_owner_delete
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id='mantiqatix-profile-media'
        AND split_part(name,'/',2)=auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.marketing_provider_profiles p
          WHERE p.id=(split_part(name,'/',4))::uuid
            AND p.owner_user_id=auth.uid()
        )
      )
    $policy$;
  END IF;
END
$profile_media_overlay$;

DO $verify_profile_media_overlay$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname IN (
      'mnty_profile_media_public_read',
      'mnty_profile_media_owner_insert',
      'mnty_profile_media_owner_update',
      'mnty_profile_media_owner_delete'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'RC484_PROFILE_MEDIA_POLICY_OVERLAY_INCOMPLETE:%',v_count;
  END IF;
END
$verify_profile_media_overlay$;

SELECT 'TEST_ONLY_RC484_PROFILE_MEDIA_POLICY_OVERLAY=PASS' AS result;
