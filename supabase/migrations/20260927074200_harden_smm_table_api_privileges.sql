-- MantiqaTix production security hardening
-- Applied to Supabase project moyhiluyhjsujhwlyeuu.
-- SMM provider/credential tables are backend-only and expose no API DML.
revoke references, trigger, truncate on table public.smm_provider_credentials from anon, authenticated;
revoke references, trigger, truncate on table public.smm_providers from anon, authenticated;
