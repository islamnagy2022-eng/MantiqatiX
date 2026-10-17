-- TEST-ONLY SYNTHETIC SHOWCASE OWNER SEED FOR DISPOSABLE MIGRATION REPLAY
-- The committed RC339 showcase seed references this fixed owner UUID; production schema capture excludes rows.
-- This fixture creates a non-login synthetic auth identity only in disposable CI, plus its public profile.
-- Email is reserved under invalid.example; password hash is empty; no tokens or credentials are issued.
-- NEVER apply this file to production.

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  'f7914ac7-4b03-4456-afdd-e386f2ac6a5b'::uuid,
  'authenticated',
  'authenticated',
  'showcase-owner@invalid.example',
  '',
  NULL,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Synthetic MantiqatiX showcase owner"}'::jsonb,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users
  WHERE id = 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b'::uuid
);

INSERT INTO public.users (
  id, tenant_id, organization_id, name, email, role, roles,
  active_workspace_role, status, custom_permissions, current_region
)
VALUES (
  'f7914ac7-4b03-4456-afdd-e386f2ac6a5b'::uuid,
  'MNTY-PLATFORM',
  NULL,
  'Synthetic MantiqatiX showcase owner',
  'showcase-owner@invalid.example',
  'OWNER',
  '["OWNER"]'::jsonb,
  'OWNER',
  'ACTIVE',
  '[]'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  organization_id = EXCLUDED.organization_id,
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  roles = EXCLUDED.roles,
  active_workspace_role = EXCLUDED.active_workspace_role,
  status = EXCLUDED.status,
  custom_permissions = EXCLUDED.custom_permissions,
  current_region = EXCLUDED.current_region,
  updated_at = now();
