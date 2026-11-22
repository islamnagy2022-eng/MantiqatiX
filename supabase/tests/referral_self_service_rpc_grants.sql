DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.get_or_create_my_referral_profile()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute get_or_create_my_referral_profile';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.claim_referral(character varying)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute claim_referral';
  END IF;
  IF has_function_privilege('anon', 'public.get_or_create_my_referral_profile()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute get_or_create_my_referral_profile';
  END IF;
  IF has_function_privilege('anon', 'public.claim_referral(character varying)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute claim_referral';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.get_or_create_my_referral_profile()'::regprocedure
      AND prosecdef
      AND coalesce(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'
      AND position('auth.uid()' in lower(pg_get_functiondef(oid))) > 0
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE oid = 'public.claim_referral(character varying)'::regprocedure
      AND prosecdef
      AND coalesce(array_to_string(proconfig, ','), '') LIKE '%search_path=""%'
      AND position('auth.uid()' in lower(pg_get_functiondef(oid))) > 0
      AND position('SELF_REFERRAL_NOT_ALLOWED' in pg_get_functiondef(oid)) > 0
  ) THEN
    RAISE EXCEPTION 'referral SECURITY DEFINER RPCs must use an empty search_path and derive identity from auth.uid()';
  END IF;
  IF has_table_privilege('anon', 'public.referral_codes', 'SELECT')
     OR has_table_privilege('anon', 'public.referral_codes', 'INSERT')
     OR has_table_privilege('anon', 'public.referral_codes', 'UPDATE')
     OR has_table_privilege('anon', 'public.referral_codes', 'DELETE')
     OR has_table_privilege('anon', 'public.referral_events', 'SELECT')
     OR has_table_privilege('anon', 'public.referral_events', 'INSERT')
     OR has_table_privilege('anon', 'public.referral_events', 'UPDATE')
     OR has_table_privilege('anon', 'public.referral_events', 'DELETE')
     OR has_table_privilege('authenticated', 'public.referral_codes', 'SELECT')
     OR has_table_privilege('authenticated', 'public.referral_codes', 'INSERT')
     OR has_table_privilege('authenticated', 'public.referral_codes', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.referral_codes', 'DELETE')
     OR has_table_privilege('authenticated', 'public.referral_events', 'SELECT')
     OR has_table_privilege('authenticated', 'public.referral_events', 'INSERT')
     OR has_table_privilege('authenticated', 'public.referral_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.referral_events', 'DELETE') THEN
    RAISE EXCEPTION 'referral tables must remain inaccessible to direct browser-role DML';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.referral_codes'::regclass AND relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.referral_events'::regclass AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on referral tables';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.referral_events'::regclass
      AND conname = 'referral_events_not_self' AND convalidated
  ) THEN
    RAISE EXCEPTION 'referral_events self-referral constraint must be validated';
  END IF;
END $$;