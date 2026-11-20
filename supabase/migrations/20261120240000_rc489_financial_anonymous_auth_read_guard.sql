-- RC489: anonymous Auth sessions cannot read private financial/payment ledgers.
-- Existing confirmed-auth membership and tenant RLS predicates remain unchanged.
BEGIN;

DO $preflight$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['commission_rules','commission_transactions','general_ledger','journal_entries','journal_entry_lines','payment_events','payment_financial_reconciliations','payment_intents','payment_provider_events','refund_transactions','settlement_attempts','settlement_transactions','subscription_payment_intents','wallet_accounts','wallet_transactions'] LOOP
    IF pg_catalog.to_regclass('public.'||v_table) IS NULL THEN
      RAISE EXCEPTION 'RC489_REQUIRED_FINANCIAL_TABLE_MISSING:%',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      WHERE c.oid=pg_catalog.to_regclass('public.'||v_table)
        AND c.relrowsecurity AND c.relforcerowsecurity
    ) THEN
      RAISE EXCEPTION 'RC489_FINANCIAL_TABLE_RLS_NOT_FORCED:%',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies p
      WHERE p.schemaname='public' AND p.tablename=v_table
        AND p.cmd IN ('SELECT','ALL')
        AND p.permissive='PERMISSIVE'
        AND 'authenticated'=ANY(p.roles)
    ) THEN
      RAISE EXCEPTION 'RC489_EXPECTED_AUTHENTICATED_READ_POLICY_MISSING:%',v_table;
    END IF;
  END LOOP;
END;
$preflight$;

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.commission_rules
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.commission_rules IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.commission_transactions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.commission_transactions IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.general_ledger
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.general_ledger IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.journal_entries
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.journal_entries IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.journal_entry_lines
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.journal_entry_lines IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.payment_events
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.payment_events IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.payment_financial_reconciliations
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.payment_financial_reconciliations IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.payment_intents
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.payment_intents IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.payment_provider_events
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.payment_provider_events IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.refund_transactions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.refund_transactions IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.settlement_attempts
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.settlement_attempts IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.settlement_transactions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.settlement_transactions IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.subscription_payment_intents
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.subscription_payment_intents IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.wallet_accounts
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.wallet_accounts IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

CREATE POLICY mnty_confirmed_auth_financial_read
ON public.wallet_transactions
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (coalesce(auth.jwt()->>'is_anonymous','false') <> 'true');

COMMENT ON POLICY mnty_confirmed_auth_financial_read ON public.wallet_transactions IS
  'RC489: private financial/payment records require a confirmed Auth identity.';

COMMIT;
