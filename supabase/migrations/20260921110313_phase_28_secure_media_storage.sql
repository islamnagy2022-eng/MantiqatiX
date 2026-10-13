BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mantiqatix-media',
  'mantiqatix-media',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS mantiqatix_media_public_read ON storage.objects;
CREATE POLICY mantiqatix_media_public_read
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'mantiqatix-media');

DROP POLICY IF EXISTS mantiqatix_media_user_insert ON storage.objects;
CREATE POLICY mantiqatix_media_user_insert
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mantiqatix-media'
  AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND (
    (name LIKE 'users/' || auth.uid()::text || '/%')
    OR
    EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id = auth.uid()
        AND m.business_id IS NOT NULL
        AND m.status = 'ACTIVE'
        AND (
          name LIKE 'businesses/' || m.business_id::text || '/%'
          AND m.role IN ('BUSINESS_OWNER','MANAGER','SUPER_ADMIN')
        )
    )
  )
);

DROP POLICY IF EXISTS mantiqatix_media_user_update ON storage.objects;
CREATE POLICY mantiqatix_media_user_update
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mantiqatix-media'
  AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND (
    owner_id = auth.uid()::text
    OR
    EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id = auth.uid()
        AND m.business_id IS NOT NULL
        AND m.status = 'ACTIVE'
        AND m.role IN ('BUSINESS_OWNER','MANAGER','SUPER_ADMIN')
        AND name LIKE 'businesses/' || m.business_id::text || '/%'
    )
  )
)
WITH CHECK (
  bucket_id = 'mantiqatix-media'
  AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
);

DROP POLICY IF EXISTS mantiqatix_media_user_delete ON storage.objects;
CREATE POLICY mantiqatix_media_user_delete
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'mantiqatix-media'
  AND coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND (
    owner_id = auth.uid()::text
    OR
    EXISTS (
      SELECT 1
      FROM public.user_memberships m
      WHERE m.user_id = auth.uid()
        AND m.business_id IS NOT NULL
        AND m.status = 'ACTIVE'
        AND m.role IN ('BUSINESS_OWNER','MANAGER','SUPER_ADMIN')
        AND name LIKE 'businesses/' || m.business_id::text || '/%'
    )
  )
);
COMMIT;
