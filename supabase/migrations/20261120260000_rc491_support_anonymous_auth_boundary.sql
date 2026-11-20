-- RC491: private support tickets and messages require a confirmed Auth identity.
-- Existing requester, assigned-agent, and tenant membership predicates remain unchanged.
BEGIN;

DO $preflight$
DECLARE v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['support_tickets','ticket_messages'] LOOP
    IF pg_catalog.to_regclass('public.'||v_table) IS NULL THEN
      RAISE EXCEPTION 'RC491_REQUIRED_SUPPORT_TABLE_MISSING:%',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      WHERE c.oid=pg_catalog.to_regclass('public.'||v_table)
        AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'RC491_SUPPORT_TABLE_RLS_NOT_FORCED:%',v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND cmd='SELECT' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND cmd='INSERT' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND cmd='UPDATE' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='ticket_messages' AND cmd='SELECT' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles))
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='public' AND tablename='ticket_messages' AND cmd='INSERT' AND permissive='PERMISSIVE' AND 'authenticated'=ANY(roles)) THEN
    RAISE EXCEPTION 'RC491_EXPECTED_SUPPORT_ACCESS_POLICIES_MISSING';
  END IF;
END;
$preflight$;

CREATE POLICY mnty_confirmed_auth_support_select
ON public.support_tickets AS RESTRICTIVE FOR SELECT TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');
CREATE POLICY mnty_confirmed_auth_support_insert
ON public.support_tickets AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');
CREATE POLICY mnty_confirmed_auth_support_update
ON public.support_tickets AS RESTRICTIVE FOR UPDATE TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true')
WITH CHECK (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

CREATE POLICY mnty_confirmed_auth_ticket_messages_select
ON public.ticket_messages AS RESTRICTIVE FOR SELECT TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');
CREATE POLICY mnty_confirmed_auth_ticket_messages_insert
ON public.ticket_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_support_select ON public.support_tickets IS
  'RC491: support tickets are visible only to confirmed Auth sessions.';
COMMENT ON POLICY mnty_confirmed_auth_support_insert ON public.support_tickets IS
  'RC491: support ticket creation requires a confirmed Auth session.';
COMMENT ON POLICY mnty_confirmed_auth_support_update ON public.support_tickets IS
  'RC491: support ticket updates require a confirmed Auth session.';
COMMENT ON POLICY mnty_confirmed_auth_ticket_messages_select ON public.ticket_messages IS
  'RC491: support messages are visible only to confirmed Auth sessions.';
COMMENT ON POLICY mnty_confirmed_auth_ticket_messages_insert ON public.ticket_messages IS
  'RC491: support message creation requires a confirmed Auth session.';

COMMIT;
