-- Disposable base schema for behavioral tests of the real RC113-RC115 employee/RBAC migrations.
-- This fixture is CI-only; it never connects to or mutates production.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE TABLE private.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id)
);

CREATE TABLE public.tenants (
  id varchar PRIMARY KEY
);

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES public.tenants(id),
  organization_id varchar,
  name text NOT NULL DEFAULT ''
);

CREATE TABLE public.branches (
  id varchar PRIMARY KEY,
  tenant_id varchar NOT NULL REFERENCES public.tenants(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id)
);

CREATE TABLE public.user_memberships (
  id varchar PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  tenant_id varchar NOT NULL REFERENCES public.tenants(id),
  organization_id varchar,
  business_id uuid REFERENCES public.businesses(id),
  branch_id varchar,
  role text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id text PRIMARY KEY,
  tenant_id varchar,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL DEFAULT 'SUCCESS',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
