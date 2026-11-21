-- Disposable RC492 fixture mirrors the observed Production privilege boundary.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  aud text NOT NULL,
  role text NOT NULL,
  email text UNIQUE,
  encrypted_password text NOT NULL DEFAULT '',
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_sso_user boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$$;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt()->>'sub','')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(),auth.uid() TO authenticated;

CREATE TABLE public.indrive_requests (
  id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  domain_type text NOT NULL,
  category_name text NOT NULL,
  title text NOT NULL,
  details_description text,
  user_proposed_price numeric,
  target_provider_type text,
  status text NOT NULL
);
ALTER TABLE public.indrive_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indrive_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY rc492_request_insert ON public.indrive_requests
  FOR INSERT TO authenticated WITH CHECK(owner_user_id=auth.uid());
CREATE POLICY rc492_request_update ON public.indrive_requests
  FOR UPDATE TO authenticated USING(owner_user_id=auth.uid()) WITH CHECK(owner_user_id=auth.uid());
CREATE POLICY rc492_request_delete ON public.indrive_requests
  FOR DELETE TO authenticated USING(owner_user_id=auth.uid());

-- Production has DELETE only on requests; do not widen this grant in the fixture.
-- Production grants table SELECT and DELETE on requests, but not INSERT or UPDATE.
GRANT SELECT, DELETE ON public.indrive_requests TO authenticated;

CREATE TABLE public.indrive_bids (
  id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.indrive_requests(id),
  provider_user_id uuid NOT NULL REFERENCES auth.users(id),
  provider_name text NOT NULL,
  provider_type text NOT NULL,
  offered_price numeric NOT NULL
);
ALTER TABLE public.indrive_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indrive_bids FORCE ROW LEVEL SECURITY;
CREATE POLICY rc492_bid_provider_read ON public.indrive_bids
  FOR SELECT TO authenticated USING(provider_user_id=auth.uid());
GRANT SELECT ON public.indrive_bids TO authenticated;
