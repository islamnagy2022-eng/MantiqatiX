-- Production-wide anonymous-session boundary.
-- Supabase anonymous users use the authenticated Postgres role, so a
-- RESTRICTIVE policy is required; a second permissive policy cannot provide
-- a true deny when other permissive policies exist.
DO $$
DECLARE
  t record;
  policy_name text := 'authenticated_sessions_only';
BEGIN
  FOR t IN
    SELECT DISTINCT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND roles::text LIKE '%authenticated%'
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = t.tablename
        AND p.policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'') WITH CHECK (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'')',
        policy_name, t.tablename
      );
    END IF;
  END LOOP;
END $$;

-- is_platform_admin only inspects the caller's own active membership.
-- SECURITY INVOKER keeps the function subject to the caller's RLS context
-- and removes the exposed SECURITY DEFINER execution surface.
ALTER FUNCTION public.is_platform_admin()
  SECURITY INVOKER
  SET search_path = public;
