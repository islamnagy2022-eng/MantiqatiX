-- RC423: make generic authenticated-session guard policies restrictive.
-- PostgreSQL combines permissive policies with OR; a generic authenticated
-- guard must never become an independent data-access grant.
DO $$
DECLARE
  r record;
  generic_names text[] := ARRAY[
    'authenticated_sessions_only',
    'deny_anonymous_users',
    'mnt_non_anonymous_boundary',
    'non_anonymous_authenticated_guard'
  ];
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname,
           COALESCE(qual, 'true') AS qual_expr,
           COALESCE(with_check, 'true') AS check_expr
    FROM pg_policies
    WHERE schemaname='public'
      AND roles @> ARRAY['authenticated']::name[]
      AND policyname = ANY(generic_names)
      AND cmd='ALL'
      AND permissive='PERMISSIVE'
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname=r.schemaname
        AND p.tablename=r.tablename
        AND p.policyname <> r.policyname
        AND p.roles @> ARRAY['authenticated']::name[]
        AND NOT (p.policyname = ANY(generic_names) AND p.cmd='ALL')
    ) THEN
      EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
        r.policyname, r.schemaname, r.tablename, r.qual_expr, r.check_expr
      );
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE bad integer;
BEGIN
  SELECT count(*) INTO bad
  FROM pg_policies
  WHERE schemaname='public'
    AND policyname IN (
      'authenticated_sessions_only',
      'deny_anonymous_users',
      'mnt_non_anonymous_boundary',
      'non_anonymous_authenticated_guard'
    )
    AND roles @> ARRAY['authenticated']::name[]
    AND cmd='ALL'
    AND permissive='PERMISSIVE';
  IF bad > 0 THEN
    RAISE EXCEPTION 'RC423_PERMISSIVE_AUTH_GUARD_REMAINS: %', bad;
  END IF;
END $$;
