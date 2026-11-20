-- RC479 forward repair: deny provider-profile base-table SELECT to anonymous Auth sessions.
-- Anonymous Auth JWTs use the authenticated PostgreSQL role, so revoking raw anon
-- table access alone does not close this read path.
-- Keep the existing owner ALL policy and confirmed-user SELECT behavior unchanged.
CREATE POLICY marketing_provider_profiles_confirmed_auth_select
ON public.marketing_provider_profiles
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);
