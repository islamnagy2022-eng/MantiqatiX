-- Disposable RC489 finance read-policy fixture. Synthetic data only.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$function$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon,authenticated,service_role;

DO $fixture$
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
    EXECUTE format('CREATE TABLE public.%I (id integer PRIMARY KEY,payload text NOT NULL)',v_table);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
    EXECUTE format('CREATE POLICY %I ON public.%I AS PERMISSIVE FOR SELECT TO authenticated USING (true)',
      v_table||'_existing_tenant_read',v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_table);
    EXECUTE format('INSERT INTO public.%I(id,payload) VALUES (1,%L)',v_table,'synthetic fixture only');
  END LOOP;
END;
$fixture$;
