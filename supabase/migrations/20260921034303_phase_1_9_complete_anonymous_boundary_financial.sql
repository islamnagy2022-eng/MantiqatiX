DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT unnest(ARRAY['financial_obligations','payment_provider_events','payout_destinations','settlement_attempts']) AS tablename
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename=t.tablename
        AND policyname='authenticated_sessions_only'
    ) THEN
      EXECUTE format(
        'CREATE POLICY authenticated_sessions_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'') WITH CHECK (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'')',
        t.tablename
      );
    END IF;
  END LOOP;
END $$;
