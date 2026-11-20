-- RC489 isolated anonymous-vs-confirmed finance SELECT test.
BEGIN;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48900000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous$
DECLARE
  v_table text;
  v_count integer;
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
    EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_count;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'RC489_ANONYMOUS_FINANCE_READ_SUCCEEDED:%:%',v_table,v_count;
    END IF;
  END LOOP;
END;
$anonymous$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"48900000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed$
DECLARE
  v_table text;
  v_count integer;
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
    EXECUTE format('SELECT count(*) FROM public.%I',v_table) INTO v_count;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'RC489_CONFIRMED_FINANCE_READ_REGRESSED:%:%',v_table,v_count;
    END IF;
  END LOOP;
END;
$confirmed$;
RESET ROLE;

ROLLBACK;
SELECT 'RC489 finance/payment anonymous Auth read boundary: PASS' AS result;
