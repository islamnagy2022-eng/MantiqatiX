
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_policies pol ON pol.schemaname = n.nspname AND pol.tablename = c.relname
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND 'authenticated' = ANY(pol.roles)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = r.schema_name
        AND p.tablename = r.table_name
        AND p.policyname = 'mnt_non_anonymous_boundary'
    ) THEN
      EXECUTE format(
        'CREATE POLICY mnt_non_anonymous_boundary ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (COALESCE((auth.jwt() ->> ''is_anonymous'')::boolean, false) = false) WITH CHECK (COALESCE((auth.jwt() ->> ''is_anonymous'')::boolean, false) = false)',
        r.schema_name, r.table_name
      );
    END IF;
  END LOOP;
END $$;
