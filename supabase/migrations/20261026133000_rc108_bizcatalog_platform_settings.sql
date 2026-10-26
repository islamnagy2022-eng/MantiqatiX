-- Private settings storage for the standalone BizCatalog production UI.
-- This schema is not exposed through the public Supabase Data API.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO service_role;

CREATE TABLE IF NOT EXISTS app_private.platform_app_settings (
  settings_key text PRIMARY KEY CHECK (settings_key = 'bizcatalog'),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_private.platform_app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE app_private.platform_app_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE app_private.platform_app_settings TO service_role;
