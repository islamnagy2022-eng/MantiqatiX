-- RC488: prevent anonymous Auth identities from mutating any Storage object.
-- Public profile-media SELECT remains intentionally available; this is write-only hardening.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'RC488_STORAGE_OBJECTS_TABLE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_update'
      AND cmd='UPDATE' AND 'authenticated'=ANY(roles)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='mnty_profile_media_owner_delete'
      AND cmd='DELETE' AND 'authenticated'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'RC488_EXPECTED_PROFILE_MEDIA_OWNER_POLICIES_MISSING';
  END IF;
END;
$preflight$;

CREATE POLICY storage_objects_confirmed_auth_insert
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
);

CREATE POLICY storage_objects_confirmed_auth_update
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
)
WITH CHECK (
  coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
);

CREATE POLICY storage_objects_confirmed_auth_delete
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
);

COMMENT ON POLICY storage_objects_confirmed_auth_insert ON storage.objects IS
  'RC488: authenticated write access requires a non-anonymous Auth identity.';
COMMENT ON POLICY storage_objects_confirmed_auth_update ON storage.objects IS
  'RC488: authenticated write access requires a non-anonymous Auth identity.';
COMMENT ON POLICY storage_objects_confirmed_auth_delete ON storage.objects IS
  'RC488: authenticated write access requires a non-anonymous Auth identity.';

COMMIT;
