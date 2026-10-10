-- RC565 disposable PostgreSQL fixture only. Never run against production.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;

DO $roles$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$roles$;
DO $roles$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$roles$;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql STABLE
AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$function$;

CREATE TABLE public.matrimony_profiles (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  gender text NOT NULL,
  pseudonym text NOT NULL,
  age integer NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  nationality text NOT NULL,
  education text NOT NULL,
  occupation text NOT NULL,
  marital_status text NOT NULL,
  religiosity_level text NOT NULL,
  housing_status text NOT NULL,
  financial_status text NOT NULL,
  about_me text NOT NULL,
  partner_requirements text NOT NULL,
  wali_contact_name text NOT NULL,
  wali_contact_phone text NOT NULL,
  direct_contact_phone text NOT NULL,
  is_verified boolean NOT NULL,
  compatibility_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matrimony_profiles ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.matrimony_profiles TO authenticated;

-- Reproduce the over-broad live SELECT policy; RC565 must replace it.
CREATE POLICY matrimony_profiles_select
ON public.matrimony_profiles
FOR SELECT TO authenticated
USING (coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true');

CREATE POLICY authenticated_sessions_only
ON public.matrimony_profiles
AS RESTRICTIVE
FOR SELECT TO authenticated
USING (coalesce(auth.jwt() ->> 'is_anonymous', 'false') <> 'true');
