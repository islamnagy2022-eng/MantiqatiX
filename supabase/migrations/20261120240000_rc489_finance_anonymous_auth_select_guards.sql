-- RC489: finance/payment reads require a confirmed Auth identity.
-- The existing tenant/membership predicates remain the permissive authorization layer.
BEGIN;

DO $preflight$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'general_ledger',
    'journal_entries',
    'journal_entry_lines',
    'payment_financial_reconciliations',
    'payment_intents',
    'payment_provider_events',
    'settlement_transactions',
    'wallet_accounts',
    'wallet_transactions'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF pg_catalog.to_regclass(format('public.%I',v_table)) IS NULL THEN
      RAISE EXCEPTION 'RC489_REQUIRED_FINANCE_TABLE_MISSING:%',v_table;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=v_table AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RC489_FINANCE_TABLE_RLS_DISABLED:%',v_table;
    END IF;
    IF NOT pg_catalog.has_table_privilege('authenticated',format('public.%I',v_table),'SELECT') THEN
      RAISE EXCEPTION 'RC489_EXPECTED_AUTHENTICATED_SELECT_GRANT_MISSING:%',v_table;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_policies
      WHERE schemaname='public' AND tablename=v_table
        AND policyname='rc489_confirmed_auth_select_guard'
    ) THEN
      RAISE EXCEPTION 'RC489_POLICY_ALREADY_EXISTS:%',v_table;
    END IF;
  END LOOP;
END;
$preflight$;

DO $install$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'general_ledger',
    'journal_entries',
    'journal_entry_lines',
    'payment_financial_reconciliations',
    'payment_intents',
    'payment_provider_events',
    'settlement_transactions',
    'wallet_accounts',
    'wallet_transactions'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    EXECUTE format(
      'CREATE POLICY rc489_confirmed_auth_select_guard ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (coalesce(auth.jwt()->>''is_anonymous'',''false'') <> ''true'')',
      v_table
    );
    EXECUTE format(
      'COMMENT ON POLICY rc489_confirmed_auth_select_guard ON public.%I IS %L',
      v_table,
      'RC489: finance/payment SELECT requires a confirmed Auth identity; existing tenant/membership policies remain in force.'
    );
  END LOOP;
END;
$install$;

COMMIT;
