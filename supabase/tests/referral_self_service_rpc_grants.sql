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
  IF has_table_privilege('authenticated', 'public.referral_codes', 'SELECT')
     OR has_table_privilege('authenticated', 'public.referral_codes', 'INSERT')
     OR has_table_privilege('authenticated', 'public.referral_events', 'SELECT')
     OR has_table_privilege('authenticated', 'public.referral_events', 'INSERT') THEN
    RAISE EXCEPTION 'referral tables must remain inaccessible to direct authenticated DML';
  END IF;
END $$;
