-- Disposable PostgreSQL fixture for RC479. Synthetic rows only.
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$function$;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $function$
  SELECT nullif(auth.jwt()->>'sub', '')::uuid
$function$;
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
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE POLICY "Owners manage their marketing provider profile"
  ON public.marketing_provider_profiles FOR ALL TO authenticated
  USING (
    COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    AND auth.uid() = owner_user_id
  )
  WITH CHECK (
    COALESCE((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
    AND auth.uid() = owner_user_id
  );
GRANT SELECT ON TABLE public.marketing_provider_profiles TO anon, authenticated, service_role;
GRANT UPDATE ON TABLE public.marketing_provider_profiles TO authenticated;
