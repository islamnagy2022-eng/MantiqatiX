-- RC567 disposable PostgreSQL fixture only. Never run against production.
CREATE SCHEMA IF NOT EXISTS auth;
DO $roles$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $roles$;
DO $roles$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $roles$;
DO $roles$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $roles$;

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
  id text PRIMARY KEY, user_id uuid NOT NULL, tenant_id text NOT NULL,
  role text NOT NULL, status text NOT NULL
);
CREATE TABLE public.approval_requests (
  id text PRIMARY KEY, tenant_id text NOT NULL, requested_by uuid NOT NULL, status text NOT NULL
);
CREATE TABLE public.approval_actions (
  id varchar PRIMARY KEY,
  approval_request_id varchar NOT NULL,
  action varchar NOT NULL,
  acted_by uuid NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_actions TO service_role;

CREATE POLICY approval_actions_member_insert ON public.approval_actions
FOR INSERT TO authenticated WITH CHECK (
  acted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.approval_requests ar
    JOIN public.user_memberships um ON um.tenant_id = ar.tenant_id
    WHERE ar.id = approval_actions.approval_request_id
      AND um.user_id = auth.uid() AND um.status = 'ACTIVE'
  )
);
CREATE POLICY approval_actions_member_read ON public.approval_actions
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.approval_requests ar
    JOIN public.user_memberships um ON um.tenant_id = ar.tenant_id
    WHERE ar.id = approval_actions.approval_request_id
      AND um.user_id = auth.uid() AND um.status = 'ACTIVE'
  )
);
