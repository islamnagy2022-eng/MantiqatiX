DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT schemaname, tablename
    FROM pg_policies
    WHERE schemaname='public'
      AND policyname='real_user_session_boundary'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 'real_user_session_boundary', r.schemaname, r.tablename);
  END LOOP;
END $$;
