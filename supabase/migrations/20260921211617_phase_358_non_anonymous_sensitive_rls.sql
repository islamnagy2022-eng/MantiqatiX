DO $$
DECLARE t text;
BEGIN
FOREACH t IN ARRAY ARRAY['business_subscriptions','commission_transactions','notifications','orders','payment_intents','payment_provider_events','settlement_transactions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS non_anonymous_authenticated_only ON public.%I', t);
  EXECUTE format('CREATE POLICY non_anonymous_authenticated_only ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((auth.jwt()->>''is_anonymous''),''false'') <> ''true'') WITH CHECK (coalesce((auth.jwt()->>''is_anonymous''),''false'') <> ''true'')', t);
END LOOP;
END $$;
