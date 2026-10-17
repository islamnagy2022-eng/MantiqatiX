
-- Make the existing fail-closed posture explicit for sensitive tables that intentionally
-- have no client-facing RLS policy. This does not grant any access and does not affect
-- service-role/Security-Definer server paths.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'erp_purchase_orders',
    'erp_purchase_receipts',
    'erp_stock_transfers',
    'smm_admins',
    'smm_provider_credentials'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS mnty_deny_unexposed_client_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY mnty_deny_unexposed_client_access ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS mnty_deny_unexposed_platform_admins ON private.platform_admins;
  CREATE POLICY mnty_deny_unexposed_platform_admins
    ON private.platform_admins
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (false) WITH CHECK (false);
END $$;
