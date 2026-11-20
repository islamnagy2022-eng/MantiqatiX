-- Disposable RC484 fixture. Never run against a shared or Production database.
DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;

CREATE TABLE private.platform_admins(
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE private.platform_admins FROM PUBLIC,anon,authenticated,service_role;
GRANT ALL ON TABLE private.platform_admins TO service_role;

CREATE TABLE public.user_memberships(
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id text NOT NULL,
  business_id text,
  branch_id text,
  role text NOT NULL,
  status text NOT NULL
);
GRANT SELECT ON public.user_memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT EXISTS(
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=auth.uid() AND m.status='ACTIVE'
      AND upper(m.role) IN ('ADMIN','SUPER_ADMIN')
  )
$function$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

DO $tables$
DECLARE
  i integer;
  j integer;
  t text;
  policy_command text;
  policy_sql text;
BEGIN
  FOR i IN 1..24 LOOP
    t:=CASE WHEN i=1 THEN 'scope_probe' ELSE 'scope_probe_'||lpad(i::text,2,'0') END;
    EXECUTE format('CREATE TABLE public.%I(id integer PRIMARY KEY,owner_user_id uuid,tenant_id text,business_id text,branch_id text)',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
  END LOOP;

  -- Mirror the live 57-policy command distribution: 18 SELECT, 17 UPDATE,
  -- 15 DELETE and 7 ALL, without importing production expressions or data.
  FOR j IN 1..57 LOOP
    i:=((j-1)%24)+1;
    t:=CASE WHEN i=1 THEN 'scope_probe' ELSE 'scope_probe_'||lpad(i::text,2,'0') END;
    policy_command:=CASE
      WHEN j<=18 THEN 'SELECT'
      WHEN j<=35 THEN 'UPDATE'
      WHEN j<=50 THEN 'DELETE'
      ELSE 'ALL'
    END;
    IF policy_command='ALL' THEN
      policy_sql:=format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.user_memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.status=''ACTIVE'' AND m.tenant_id=%I.tenant_id AND m.business_id=%I.business_id AND m.branch_id=%I.branch_id))',
        'rc484_policy_'||j,t,t,t,t
      );
      policy_sql:=policy_sql||format(
        ' WITH CHECK (public.is_platform_admin() OR EXISTS (SELECT 1 FROM public.user_memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.status=''ACTIVE'' AND m.tenant_id=%I.tenant_id AND m.business_id=%I.business_id AND m.branch_id=%I.branch_id))',
        t,t,t
      );
    ELSE
      policy_sql:=format(
        'CREATE POLICY %I ON public.%I FOR %s TO authenticated USING (owner_user_id=(SELECT auth.uid()) OR public.is_platform_admin())',
        'rc484_policy_'||j,t,policy_command
      );
      IF policy_command='UPDATE' THEN
        policy_sql:=policy_sql||' WITH CHECK (owner_user_id=(SELECT auth.uid()) OR public.is_platform_admin())';
      END IF;
    END IF;
    EXECUTE policy_sql;
  END LOOP;
END;
$tables$;

INSERT INTO auth.users(id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');

INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status) VALUES
 ('tenant-admin','10000000-0000-4000-8000-000000000001','TENANT-A','BUSINESS-A','BRANCH-A','ADMIN','ACTIVE'),
 ('tenant-super-admin','10000000-0000-4000-8000-000000000002','TENANT-B','BUSINESS-B','BRANCH-B','SUPER_ADMIN','ACTIVE');

INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000003');

INSERT INTO public.scope_probe(id,owner_user_id,tenant_id) VALUES
 (1,'10000000-0000-4000-8000-000000000001','TENANT-A'),
 (2,'10000000-0000-4000-8000-000000000002','TENANT-B'),
 (3,NULL,'TENANT-C');

-- The seven live ALL policies include a tenant/business/branch membership path.
-- This representative table exercises that local-admin path alongside platform root.
INSERT INTO public.scope_probe_03(id,owner_user_id,tenant_id,business_id,branch_id) VALUES
 (1,'10000000-0000-4000-8000-000000000002','TENANT-A','BUSINESS-A','BRANCH-A'),
 (2,'10000000-0000-4000-8000-000000000003','TENANT-B','BUSINESS-B','BRANCH-B'),
 (3,NULL,'TENANT-A','BUSINESS-A','BRANCH-OTHER'),
 (9,NULL,'TENANT-A','BUSINESS-OTHER','BRANCH-A');
