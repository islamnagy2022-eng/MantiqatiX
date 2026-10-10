-- RC566 disposable PostgreSQL fixture only. Never run against production.
CREATE SCHEMA IF NOT EXISTS auth;
DO $roles$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $roles$;
DO $roles$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $roles$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth.jwt() TO PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;

CREATE TABLE public.user_memberships (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id text NOT NULL,
  business_id uuid,
  role text NOT NULL,
  status text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.marketing_leads (
  id uuid PRIMARY KEY,
  requester_user_id uuid NOT NULL,
  requester_business_id uuid,
  title text NOT NULL
);
CREATE TABLE public.marketing_provider_profiles (
  id uuid PRIMARY KEY,
  business_id uuid,
  owner_user_id uuid NOT NULL,
  name_ar text NOT NULL,
  status text NOT NULL
);

GRANT SELECT ON public.user_memberships TO authenticated;
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.marketing_leads, public.marketing_provider_profiles TO authenticated;

-- Reproduce the current broad manager policies and legitimate owner/public paths.
CREATE POLICY "CRM managers view marketing leads" ON public.marketing_leads
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid() AND um.status='ACTIVE'
      AND upper(coalesce(um.role,'')) IN ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'))
);
CREATE POLICY "Users view own marketing leads" ON public.marketing_leads
FOR SELECT TO authenticated USING (requester_user_id=auth.uid());
CREATE POLICY "CRM managers view marketing providers" ON public.marketing_provider_profiles
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid() AND um.status='ACTIVE'
      AND upper(coalesce(um.role,'')) IN ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER'))
);
CREATE POLICY "Owners manage their marketing provider profile" ON public.marketing_provider_profiles
FOR ALL TO authenticated USING (
  coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' AND owner_user_id=auth.uid()
) WITH CHECK (
  coalesce(auth.jwt()->>'is_anonymous','false') <> 'true' AND owner_user_id=auth.uid()
);
CREATE POLICY "Public can view active marketing providers" ON public.marketing_provider_profiles
FOR SELECT TO anon, authenticated USING (status='ACTIVE');
