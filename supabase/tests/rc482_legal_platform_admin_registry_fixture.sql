-- Disposable RC482 PostgreSQL fixture. No production data is used.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$function$;

CREATE TABLE private.platform_admins (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_memberships (
  id varchar PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id varchar NOT NULL,
  business_id uuid,
  branch_id varchar,
  role varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'ACTIVE',
  permissions jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000001');

INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,role,status,permissions)
VALUES
 ('root-admin','10000000-0000-4000-8000-000000000001','PLATFORM',NULL,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'),
 ('business-admin','20000000-0000-4000-8000-000000000002','TENANT-A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ADMIN','ACTIVE','{"admin":true}'),
 ('legal-admin-label','30000000-0000-4000-8000-000000000003','TENANT-B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','LEGAL_ADMIN','ACTIVE','{"admin":true}'),
 ('tenant-super-admin','40000000-0000-4000-8000-000000000004','TENANT-C','cccccccc-cccc-4ccc-8ccc-cccccccccccc','SUPER_ADMIN','ACTIVE','{"scope":"TENANT","full_control":true}');

-- Reproduce the vulnerable pre-RC482 helper definitions and grants.
CREATE FUNCTION private.legal_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=(SELECT auth.uid())
      AND coalesce(m.status,'ACTIVE')='ACTIVE'
      AND upper(m.role) IN ('SUPER_ADMIN','ADMIN','LEGAL_ADMIN')
  );
$function$;

REVOKE ALL ON FUNCTION private.legal_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.legal_is_admin() FROM anon;
REVOKE ALL ON FUNCTION private.legal_is_admin() FROM service_role;
GRANT EXECUTE ON FUNCTION private.legal_is_admin() TO authenticated;

CREATE FUNCTION private.legal_is_admin(p_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id=coalesce(p_user_id,(SELECT auth.uid()))
      AND coalesce(m.status,'ACTIVE')='ACTIVE'
      AND upper(m.role) IN ('SUPER_ADMIN','ADMIN','LEGAL_ADMIN')
  );
$function$;

GRANT USAGE ON SCHEMA auth,private,public TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.legal_is_admin() TO authenticated;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION private.legal_is_admin(uuid) TO authenticated;
