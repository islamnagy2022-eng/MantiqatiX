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
-- Mirror the current Production ACL so the RC484 migration must actively remove it.
GRANT ALL ON TABLE private.platform_admins TO service_role;

CREATE TABLE public.user_memberships(
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id text NOT NULL,
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
  j integer:=0;
  t text;
BEGIN
  FOR i IN 1..24 LOOP
    t:=CASE WHEN i=1 THEN 'scope_probe' ELSE 'scope_probe_'||lpad(i::text,2,'0') END;
    EXECUTE format('CREATE TABLE public.%I(id integer PRIMARY KEY,owner_user_id uuid,tenant_id text)',t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (owner_user_id=(SELECT auth.uid()) OR public.is_platform_admin())',
      'rc484_base_'||i,t
    );
  END LOOP;

  -- The production snapshot has 57 helper-dependent policies over 24 tables.
  -- Add 33 distinct policies to the first nine fixture tables to reproduce that
  -- blast-radius shape without importing Production data or policy contents.
  FOR j IN 1..33 LOOP
    i:=((j-1)%9)+1;
    t:=CASE WHEN i=1 THEN 'scope_probe' ELSE 'scope_probe_'||lpad(i::text,2,'0') END;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_admin())',
      'rc484_extra_'||j,t
    );
  END LOOP;
END;
$tables$;

INSERT INTO auth.users(id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');

INSERT INTO public.user_memberships(id,user_id,tenant_id,role,status) VALUES
 ('tenant-admin','10000000-0000-4000-8000-000000000001','TENANT-A','ADMIN','ACTIVE'),
 ('tenant-super-admin','10000000-0000-4000-8000-000000000002','TENANT-B','SUPER_ADMIN','ACTIVE');

INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000003');

INSERT INTO public.scope_probe(id,owner_user_id,tenant_id) VALUES
 (1,'10000000-0000-4000-8000-000000000001','TENANT-A'),
 (2,'10000000-0000-4000-8000-000000000002','TENANT-B'),
 (3,NULL,'TENANT-C');
