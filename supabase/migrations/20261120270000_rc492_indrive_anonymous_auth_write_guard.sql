-- RC492: anonymous Auth sessions cannot create, modify, or delete InDrive requests or read bids.
-- Existing owner and platform-admin predicates remain unchanged for confirmed users.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.indrive_requests') IS NULL THEN
    RAISE EXCEPTION 'RC492_INDRIVE_REQUESTS_TABLE_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid='public.indrive_requests'::regclass
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'RC492_INDRIVE_REQUESTS_RLS_NOT_FORCED';
  END IF;
  -- Do not require or add direct table grants here. Production intentionally exposes
  -- only DELETE to authenticated; absent INSERT/UPDATE grants remain absent.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='indrive_requests' AND cmd='INSERT' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='indrive_requests' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='indrive_requests' AND cmd='DELETE' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'RC492_EXPECTED_OWNER_WRITE_POLICIES_MISSING';
  END IF;
  IF pg_catalog.to_regclass('public.indrive_bids') IS NULL THEN
    RAISE EXCEPTION 'RC492_INDRIVE_BIDS_TABLE_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid='public.indrive_bids'::regclass
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'RC492_INDRIVE_BIDS_RLS_NOT_FORCED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='indrive_bids'
      AND cmd='SELECT' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'RC492_INDRIVE_BIDS_READ_POLICY_MISSING';
  END IF;
END;
$preflight$;

CREATE POLICY mnty_confirmed_auth_indrive_insert
ON public.indrive_requests AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE);

CREATE POLICY mnty_confirmed_auth_indrive_update
ON public.indrive_requests AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE)
WITH CHECK ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE);

CREATE POLICY mnty_confirmed_auth_indrive_delete
ON public.indrive_requests AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE);

COMMENT ON POLICY mnty_confirmed_auth_indrive_insert ON public.indrive_requests IS
  'RC492: InDrive request creation requires a confirmed Auth identity.';
COMMENT ON POLICY mnty_confirmed_auth_indrive_update ON public.indrive_requests IS
  'RC492: InDrive request updates require a confirmed Auth identity.';
COMMENT ON POLICY mnty_confirmed_auth_indrive_delete ON public.indrive_requests IS
  'RC492: InDrive request deletion requires a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_indrive_bids_read
ON public.indrive_bids AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE);

COMMENT ON POLICY mnty_confirmed_auth_indrive_bids_read ON public.indrive_bids IS
  'RC492: InDrive bid visibility requires a confirmed Auth identity, including when the is_anonymous claim is missing.';

COMMIT;
