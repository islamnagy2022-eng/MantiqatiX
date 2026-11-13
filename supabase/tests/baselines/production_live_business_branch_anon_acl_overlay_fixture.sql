\set ON_ERROR_STOP on

-- Test-only ACL overlay for the captured 2026-10-17 schema checkpoint.
-- A read-only check of the current live project (2026-11-14) confirmed:
--   public.businesses: anon has no SELECT privilege
--   public.branches:   anon has no SELECT privilege
-- The older schema-only checkpoint and local Supabase bootstrap can carry broader historical/default grants (including inherited PUBLIC privileges).
-- Align only the disposable replay database with the observed live ACL boundary.
-- This file is never a production migration and is never deployed.

BEGIN;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.businesses, public.branches
  FROM anon, PUBLIC;

DO $verify$
BEGIN
  IF pg_catalog.has_table_privilege('anon', 'public.businesses', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.branches', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.businesses', 'INSERT,UPDATE,DELETE')
     OR pg_catalog.has_table_privilege('anon', 'public.branches', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'LIVE_ACL_OVERLAY_FAILED: anon retains unexpected table access';
  END IF;
END;
$verify$;

COMMIT;
