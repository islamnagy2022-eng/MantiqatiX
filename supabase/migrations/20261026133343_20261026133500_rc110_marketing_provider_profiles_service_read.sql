-- Restore the minimum read privilege required by the trusted catalog Edge Function.
-- This does not grant new access to anon or authenticated roles.
GRANT SELECT ON TABLE public.marketing_provider_profiles TO service_role;
