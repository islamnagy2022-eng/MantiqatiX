-- RC491: private support-ticket reads require a confirmed Auth identity.
-- Existing requester, assigned-agent, and tenant membership predicates remain unchanged.
BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regclass('public.support_tickets') IS NULL THEN
    RAISE EXCEPTION 'RC491_SUPPORT_TICKETS_TABLE_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    WHERE c.oid='public.support_tickets'::regclass
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'RC491_SUPPORT_TICKETS_RLS_NOT_FORCED';
  END IF;
  IF NOT has_table_privilege('authenticated','public.support_tickets','SELECT') THEN
    RAISE EXCEPTION 'RC491_SUPPORT_TICKETS_SELECT_GRANT_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies p
    WHERE p.schemaname='public' AND p.tablename='support_tickets'
      AND p.cmd='SELECT' AND p.permissive='PERMISSIVE'
      AND 'authenticated'=ANY(p.roles)
  ) THEN
    RAISE EXCEPTION 'RC491_EXPECTED_SUPPORT_READ_POLICY_MISSING';
  END IF;
END;
$preflight$;

CREATE POLICY mnty_confirmed_auth_support_select
ON public.support_tickets AS RESTRICTIVE FOR SELECT TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_support_select ON public.support_tickets IS
  'RC491: support tickets are visible only to confirmed Auth sessions.';

COMMIT;
