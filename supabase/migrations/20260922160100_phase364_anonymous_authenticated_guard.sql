-- Phase 3.64: fail-closed guard for Supabase anonymous sessions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'authenticated' = ANY(roles)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname='public'
        AND tablename=r.tablename
        AND policyname='non_anonymous_authenticated_guard'
    ) THEN
      EXECUTE format(
        'CREATE POLICY non_anonymous_authenticated_guard ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'') WITH CHECK (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'')',
        r.tablename
      );
    END IF;
  END LOOP;
END $$;
