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
