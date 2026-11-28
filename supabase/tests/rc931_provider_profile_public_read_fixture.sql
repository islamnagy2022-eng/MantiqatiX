-- RC931 disposable PostgreSQL fixture. Synthetic data only.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$function$;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $function$
  SELECT nullif(auth.jwt()->>'sub', '')::uuid
$function$;

DO $roles$
BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$roles$;
DO $roles$
BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$roles$;
DO $roles$
BEGIN
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$roles$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

-- Model the post-RC484 platform-root authority contract.
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.platform_admins (
  user_id uuid PRIMARY KEY
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;
GRANT ALL ON TABLE private.platform_admins TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins pa
    WHERE pa.user_id=(SELECT auth.uid())
  )
$function$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL
);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_memberships (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id text NOT NULL,
  business_id uuid,
  role text NOT NULL,
  status text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_select_self ON public.user_memberships
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY businesses_member_select ON public.businesses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id = businesses.tenant_id
      AND um.status = 'ACTIVE'
  ));

CREATE TABLE public.marketing_provider_profiles (
  id uuid PRIMARY KEY,
  provider_kind text NOT NULL DEFAULT 'OFFICIAL',
  business_id uuid,
  owner_user_id uuid,
  name_ar text NOT NULL,
  slug text,
  description text,
  is_verified boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  service_areas jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_image_path text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL
);
ALTER TABLE public.marketing_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "CRM managers view marketing providers"
  ON public.marketing_provider_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.status = 'ACTIVE'
      AND upper(coalesce(um.role,'')) IN ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  ));
CREATE POLICY "Owners manage their marketing provider profile"
  ON public.marketing_provider_profiles FOR ALL TO authenticated
  USING (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    AND auth.uid() = owner_user_id
  )
  WITH CHECK (
    coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    AND auth.uid() = owner_user_id
  );
CREATE POLICY "Public can view active marketing providers"
  ON public.marketing_provider_profiles FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE');

CREATE TABLE public.marketing_leads (
  id uuid PRIMARY KEY,
  requester_user_id uuid,
  requester_business_id uuid,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  source text NOT NULL DEFAULT 'PLATFORM',
  assigned_provider_id uuid,
  currency text NOT NULL DEFAULT 'EGP'
);
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CRM managers view marketing leads"
  ON public.marketing_leads FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.status = 'ACTIVE'
      AND upper(coalesce(um.role,'')) IN ('SUPER_ADMIN','ADMIN','OWNER','MANAGER','BUSINESS_OWNER')
  ));
CREATE POLICY "Users view own marketing leads"
  ON public.marketing_leads FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());
CREATE POLICY "Users create marketing leads"
  ON public.marketing_leads FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.businesses, public.user_memberships, public.marketing_provider_profiles, public.marketing_leads
  TO authenticated;
GRANT INSERT, UPDATE ON public.marketing_provider_profiles TO authenticated;
GRANT SELECT ON public.marketing_provider_profiles TO anon, service_role;
GRANT INSERT ON public.marketing_leads TO authenticated;

INSERT INTO public.businesses(id,tenant_id,name) VALUES
  ('30000000-0000-4000-8000-000000000001','TENANT-A','Agency A'),
  ('30000000-0000-4000-8000-000000000002','TENANT-A','Client A2'),
  ('30000000-0000-4000-8000-000000000003','TENANT-B','Agency B'),
  ('30000000-0000-4000-8000-000000000004','TENANT-C','Agency C'),
  ('30000000-0000-4000-8000-000000000005','MNTY-PLATFORM','Platform Tenant Business');

INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,role,status,permissions) VALUES
  ('manager-a','30000000-0000-4000-8000-000000000011','TENANT-A','30000000-0000-4000-8000-000000000001','MANAGER','ACTIVE','{}'),
  ('owner-a','30000000-0000-4000-8000-000000000018','TENANT-A','30000000-0000-4000-8000-000000000001','OWNER','ACTIVE','{}'),
  ('tenant-admin-a','30000000-0000-4000-8000-000000000012','TENANT-A',NULL,'ADMIN','ACTIVE','{}'),
  ('manager-b','30000000-0000-4000-8000-000000000013','TENANT-B','30000000-0000-4000-8000-000000000003','MANAGER','ACTIVE','{}'),
  ('tenant-super-c','30000000-0000-4000-8000-000000000014','TENANT-C','30000000-0000-4000-8000-000000000004','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
  ('platform-admin-registered','30000000-0000-4000-8000-000000000015','MNTY-PLATFORM',NULL,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
  ('platform-admin-unregistered','30000000-0000-4000-8000-000000000020','MNTY-PLATFORM',NULL,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
  ('provider-a','30000000-0000-4000-8000-000000000016','TENANT-A','30000000-0000-4000-8000-000000000001','SERVICE_PROVIDER','ACTIVE','{}'),
  ('lead-owner','30000000-0000-4000-8000-000000000017','TENANT-B','30000000-0000-4000-8000-000000000003','CUSTOMER','ACTIVE','{}'),
  ('public-customer','30000000-0000-4000-8000-000000000099','TENANT-A','30000000-0000-4000-8000-000000000002','CUSTOMER','ACTIVE','{}');

INSERT INTO private.platform_admins(user_id)
VALUES ('30000000-0000-4000-8000-000000000015');

INSERT INTO public.marketing_provider_profiles(id,business_id,owner_user_id,name_ar,status,settings) VALUES
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000016','Provider A','ACTIVE','{"private":"synthetic-A"}'),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',NULL,'Pending Provider A','PENDING','{"private":"pending-A"}'),
  ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003',NULL,'Pending Provider B','PENDING','{"private":"pending-B"}'),
  ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003',NULL,'Active Provider B','ACTIVE','{"private":"active-B"}'),
  ('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000016','Provider A Pending Own Profile','PENDING','{"private":"owner-pending"}'),
  ('40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000002',NULL,'Pending Provider A2','PENDING','{"private":"pending-A2"}'),
  ('40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000005',NULL,'Platform Tenant Pending Provider','PENDING','{"private":"platform-tenant-only"}');

-- Platform-owned settings prove that owner logo changes preserve all other keys.
UPDATE public.marketing_provider_profiles
SET settings = jsonb_build_object(
  'official_showcase', true,
  'managed_by', 'SUPER_ADMIN',
  'activity_code', 'HEALTH',
  'branding', jsonb_build_object(
    'logo_path', 'assets/original-provider-a.svg',
    'preserve_me', 'platform-owned'
  )
)
WHERE id = '40000000-0000-4000-8000-000000000001';
