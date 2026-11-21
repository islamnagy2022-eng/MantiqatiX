-- TEST ONLY: restore the three known Production platform-brand Storage policies
-- omitted from the captured schema checkpoint, so RC495 can replace their
-- membership-derived authority and over-escaped filename predicates.
-- Never apply this fixture to a hosted or production database.
DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('storage.objects') IS NULL
     OR pg_catalog.to_regclass('public.user_memberships') IS NULL THEN
    RAISE EXCEPTION 'RC495_TEST_OVERLAY_REQUIRED_OBJECT_MISSING';
  END IF;
END;
$preflight$;

DO $overlay$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_platform_brand_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_platform_brand_insert
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id='mantiqatix-profile-media'
        AND name ~ '^platform/branding/(logo|mark)-[0-9]+\\\\.(jpg|jpeg|png|webp|svg)$'
        AND EXISTS (
          SELECT 1 FROM public.user_memberships m
          WHERE m.user_id=auth.uid()
            AND m.status='ACTIVE'
            AND upper(m.role)='SUPER_ADMIN'
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_platform_brand_update'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_platform_brand_update
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id='mantiqatix-profile-media'
        AND name ~ '^platform/branding/(logo|mark)-[0-9]+\\\\.(jpg|jpeg|png|webp|svg)$'
        AND EXISTS (
          SELECT 1 FROM public.user_memberships m
          WHERE m.user_id=auth.uid()
            AND m.status='ACTIVE'
            AND upper(m.role)='SUPER_ADMIN'
        )
      )
      WITH CHECK (
        bucket_id='mantiqatix-profile-media'
        AND name ~ '^platform/branding/(logo|mark)-[0-9]+\\\\.(jpg|jpeg|png|webp|svg)$'
        AND EXISTS (
          SELECT 1 FROM public.user_memberships m
          WHERE m.user_id=auth.uid()
            AND m.status='ACTIVE'
            AND upper(m.role)='SUPER_ADMIN'
        )
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_platform_brand_delete'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY mnty_platform_brand_delete
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id='mantiqatix-profile-media'
        AND name ~ '^platform/branding/(logo|mark)-[0-9]+\\\\.(jpg|jpeg|png|webp|svg)$'
        AND EXISTS (
          SELECT 1 FROM public.user_memberships m
          WHERE m.user_id=auth.uid()
            AND m.status='ACTIVE'
            AND upper(m.role)='SUPER_ADMIN'
        )
      )
    $policy$;
  END IF;
END
$overlay$;

DO $verify$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_catalog.pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND 'authenticated'=ANY(roles)
    AND (policyname,cmd) IN (
      ('mnty_platform_brand_insert','INSERT'),
      ('mnty_platform_brand_update','UPDATE'),
      ('mnty_platform_brand_delete','DELETE')
    );
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'RC495_TEST_OVERLAY_POLICY_SET_INCOMPLETE:%',v_count;
  END IF;
END;
$verify$;

SELECT 'TEST_ONLY_RC495_STORAGE_BRAND_POLICY_OVERLAY=PASS' AS result;
