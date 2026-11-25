-- RC927: keep public published-page reads for raw anon while denying
-- Anonymous Auth sessions direct SELECT on the full digital_pages base row.
-- RC480's column allowlist remains the raw-anon public renderer boundary.
-- Authenticated, confirmed users retain the existing page-owner read path.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.digital_pages') IS NULL THEN
    RAISE EXCEPTION 'RC927_DIGITAL_PAGES_TABLE_MISSING';
  END IF;

  IF pg_catalog.to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE EXCEPTION 'RC927_AUTH_JWT_HELPER_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname='public'
      AND tablename='digital_pages'
      AND policyname='digital_pages_public_read'
      AND cmd='SELECT'
      AND permissive='PERMISSIVE'
      AND roles @> ARRAY['anon']::name[]
  ) THEN
    RAISE EXCEPTION 'RC927_PUBLIC_ANON_PAGE_READ_POLICY_MISSING';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated','public.digital_pages','SELECT') THEN
    RAISE EXCEPTION 'RC927_AUTHENTICATED_PAGE_OWNER_SELECT_GRANT_MISSING';
  END IF;

  IF pg_catalog.has_table_privilege('anon','public.digital_pages','SELECT') THEN
    RAISE EXCEPTION 'RC927_RC480_ANON_TABLE_LEVEL_SELECT_STILL_GRANTED';
  END IF;

  IF NOT pg_catalog.has_column_privilege('anon','public.digital_pages','id','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','slug','SELECT')
     OR NOT pg_catalog.has_column_privilege('anon','public.digital_pages','title','SELECT')
     OR pg_catalog.has_column_privilege('anon','public.digital_pages','created_by','SELECT') THEN
    RAISE EXCEPTION 'RC927_RC480_PUBLIC_COLUMN_ALLOWLIST_NOT_PRESENT';
  END IF;
END;
$preflight$;

CREATE POLICY digital_pages_confirmed_auth_select
ON public.digital_pages
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  (SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE
);

COMMENT ON POLICY digital_pages_confirmed_auth_select ON public.digital_pages IS
  'RC927: direct base-table SELECT requires an explicitly confirmed Auth identity. Raw anon public reads remain governed by RC480 column grants and digital_pages_public_read.';

COMMIT;
