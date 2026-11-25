-- RC926: require an explicit confirmed Auth identity for provider-profile base-table SELECT.
-- The earlier RC479 forward guard treated a missing is_anonymous claim as confirmed.
-- Public discovery remains on the curated service-role Edge projection; raw anon stays revoked.
BEGIN;

DO $rc926_preflight$
DECLARE
  v_rls_enabled boolean;
BEGIN
  SELECT c.relrowsecurity
    INTO v_rls_enabled
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND c.relname='marketing_provider_profiles'
     AND c.relkind IN ('r','p');

  IF v_rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'RC926_PROVIDER_PROFILE_RLS_REQUIRED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC926_AUTHENTICATED_PROVIDER_PROFILE_SELECT_REQUIRED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role','public.marketing_provider_profiles','SELECT') THEN
    RAISE EXCEPTION 'RC926_SERVICE_ROLE_PROVIDER_PROFILE_SELECT_REQUIRED';
  END IF;
END;
$rc926_preflight$;

-- Preserve the intended raw-anon denial even if an older snapshot reintroduced its grant.
REVOKE SELECT ON TABLE public.marketing_provider_profiles FROM anon;

-- Replace the RC479 COALESCE predicate: missing/NULL claims must not become confirmed users.
DROP POLICY IF EXISTS marketing_provider_profiles_confirmed_auth_select
  ON public.marketing_provider_profiles;

CREATE POLICY marketing_provider_profiles_confirmed_auth_select
ON public.marketing_provider_profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  (SELECT auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'
);

COMMIT;
