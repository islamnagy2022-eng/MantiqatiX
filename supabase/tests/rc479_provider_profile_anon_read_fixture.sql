-- Disposable PostgreSQL fixture for RC479. Synthetic rows only.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE TABLE public.marketing_provider_profiles (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  name_ar text NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL
);

INSERT INTO public.marketing_provider_profiles(id,owner_user_id,name_ar,settings,status) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Provider A','{"private":"synthetic"}','ACTIVE'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Provider B','{"private":"synthetic"}','INACTIVE');

ALTER TABLE public.marketing_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_provider_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active marketing providers"
  ON public.marketing_provider_profiles FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE');

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketing_provider_profiles TO anon, authenticated, service_role;
