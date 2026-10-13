BEGIN;

DO $$
DECLARE
  r record;
  excluded text[] := ARRAY[
    'ad_spaces',
    'legal_documents',
    'legal_document_versions',
    'marketing_plans',
    'marketing_provider_profiles',
    'marketing_provider_services',
    'marketing_services'
  ];
  policy_name text;
BEGIN
  FOR r IN
    SELECT DISTINCT p.schemaname, p.tablename
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND 'authenticated' = ANY(p.roles)
      AND p.tablename <> ALL(excluded)
      AND COALESCE(p.qual,'') !~* 'is_anonymous'
      AND COALESCE(p.with_check,'') !~* 'is_anonymous'
  LOOP
    policy_name := 'real_user_session_boundary';
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies x
      WHERE x.schemaname = r.schemaname
        AND x.tablename = r.tablename
        AND x.policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'') WITH CHECK (COALESCE((auth.jwt() ->> ''is_anonymous''), ''false'') <> ''true'')',
        policy_name, r.schemaname, r.tablename
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
