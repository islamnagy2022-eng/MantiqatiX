-- Explicit service-role-only access policy for BizCatalog platform settings.
-- Anonymous and authenticated roles have no table grants and no RLS policy.
DROP POLICY IF EXISTS bizcatalog_platform_settings_service_role_only
  ON public.bizcatalog_platform_settings;

CREATE POLICY bizcatalog_platform_settings_service_role_only
  ON public.bizcatalog_platform_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
