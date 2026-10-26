-- Additive, service-role-only settings for BizCatalog platform configuration.
-- The table is in public so Supabase REST can reach it from the Edge Function;
-- all non-service roles have no table privileges and RLS is enabled.
CREATE TABLE IF NOT EXISTS public.bizcatalog_platform_settings (
  settings_key text PRIMARY KEY CHECK (settings_key = 'bizcatalog'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bizcatalog_platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bizcatalog_platform_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bizcatalog_platform_settings TO service_role;
