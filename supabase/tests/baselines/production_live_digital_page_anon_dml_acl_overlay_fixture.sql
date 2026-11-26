-- TEST-ONLY ACL overlay for the isolated 84-version forward replay.
-- The read-only Production ACL snapshot records anon SELECT only and no anon
-- INSERT/UPDATE/DELETE on either relation. A fresh local Supabase instance may
-- seed wider anon defaults before the schema-only checkpoint is restored; align
-- this disposable database with the observed live ACL before replaying RC927.
-- Never run this fixture against a hosted/Production database.
BEGIN;

REVOKE INSERT, UPDATE, DELETE
  ON TABLE public.digital_pages, public.digital_page_sections
  FROM PUBLIC, anon;

DO $rc927_anon_dml_overlay$
BEGIN
  IF pg_catalog.has_table_privilege('anon','public.digital_pages','INSERT')
     OR pg_catalog.has_table_privilege('anon','public.digital_pages','UPDATE')
     OR pg_catalog.has_table_privilege('anon','public.digital_pages','DELETE')
     OR pg_catalog.has_table_privilege('anon','public.digital_page_sections','INSERT')
     OR pg_catalog.has_table_privilege('anon','public.digital_page_sections','UPDATE')
     OR pg_catalog.has_table_privilege('anon','public.digital_page_sections','DELETE') THEN
    RAISE EXCEPTION 'TEST_ONLY_RC927_ANON_DML_ACL_OVERLAY_FAILED';
  END IF;
END
$rc927_anon_dml_overlay$;

COMMIT;
