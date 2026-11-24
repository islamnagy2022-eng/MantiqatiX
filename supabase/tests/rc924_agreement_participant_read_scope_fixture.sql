-- Disposable RC924 PostgreSQL fixture. No production data is used.
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

CREATE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$function$;

CREATE TABLE private.platform_admins (
  user_id uuid PRIMARY KEY
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;
INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000001');

-- Mirror the RC482 post-migration legal-root boundary: tenant role labels
-- are not platform legal authority unless the actor is in private.platform_admins.
CREATE TABLE public.user_memberships (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id varchar NOT NULL,
  business_id uuid,
  role varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'ACTIVE',
  permissions jsonb
);
INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,role,status,permissions) VALUES
 ('tenant-admin','70000000-0000-4000-8000-000000000001','TENANT-X','dddddddd-dddd-4ddd-8ddd-dddddddddddd','ADMIN','ACTIVE','{"admin":true}'::jsonb),
 ('tenant-super-admin','70000000-0000-4000-8000-000000000002','TENANT-Y','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
 ('delegated-legal-admin','70000000-0000-4000-8000-000000000003','TENANT-Z','ffffffff-ffff-4fff-8fff-ffffffffffff','LEGAL_ADMIN','ACTIVE','{"admin":true}'::jsonb),
 ('rc482-business-admin','20000000-0000-4000-8000-000000000002','TENANT-RC482-A','dddddddd-dddd-4ddd-8ddd-dddddddddddd','ADMIN','ACTIVE','{"admin":true}'::jsonb),
 ('rc482-legal-admin','30000000-0000-4000-8000-000000000003','TENANT-RC482-B','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','LEGAL_ADMIN','ACTIVE','{"admin":true}'::jsonb),
 ('rc482-tenant-super-admin','40000000-0000-4000-8000-000000000004','TENANT-RC482-C','ffffffff-ffff-4fff-8fff-ffffffffffff','SUPER_ADMIN','ACTIVE','{"scope":"TENANT","full_control":true}'::jsonb);

-- Reproduce the live pre-RC482 helper definitions. RC482 must be applied
-- before RC924 or the participant policy would still inherit tenant-wide authority.
CREATE FUNCTION private.legal_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id = (SELECT auth.uid())
      AND coalesce(m.status,'ACTIVE') = 'ACTIVE'
      AND upper(m.role) IN ('SUPER_ADMIN','ADMIN','LEGAL_ADMIN')
  );
$function$;

CREATE FUNCTION private.legal_is_admin(p_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id = coalesce(p_user_id,(SELECT auth.uid()))
      AND coalesce(m.status,'ACTIVE') = 'ACTIVE'
      AND upper(m.role) IN ('SUPER_ADMIN','ADMIN','LEGAL_ADMIN')
  );
$function$;

REVOKE ALL ON FUNCTION private.legal_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.legal_is_admin() FROM anon;
REVOKE ALL ON FUNCTION private.legal_is_admin() FROM service_role;
GRANT EXECUTE ON FUNCTION private.legal_is_admin() TO authenticated;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM service_role;
GRANT EXECUTE ON FUNCTION private.legal_is_admin(uuid) TO authenticated;

CREATE TABLE public.agreements (
  id uuid PRIMARY KEY,
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL,
  status varchar NOT NULL
);

CREATE TABLE public.agreement_participants (
  id uuid PRIMARY KEY,
  agreement_id uuid NOT NULL REFERENCES public.agreements(id),
  user_id uuid NOT NULL,
  account_type varchar NOT NULL DEFAULT 'BUSINESS',
  participant_role varchar NOT NULL DEFAULT 'PARTNER',
  status varchar NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING','ACTIVE','DECLINED','SUSPENDED','TERMINATED'))
);

INSERT INTO public.agreements(id,tenant_id,business_id,status) VALUES
 ('10000000-0000-4000-8000-000000000001','TENANT-A','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ACTIVE'),
 ('10000000-0000-4000-8000-000000000002','TENANT-B','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ACTIVE'),
 ('10000000-0000-4000-8000-000000000003','TENANT-C','cccccccc-cccc-4ccc-8ccc-cccccccccccc','ACTIVE');

INSERT INTO public.agreement_participants(id,agreement_id,user_id) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003');

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreement_participants FORCE ROW LEVEL SECURITY;

CREATE POLICY agreement_participants_read
  ON public.agreement_participants
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      private.legal_is_admin((SELECT auth.uid()))
      OR user_id = (SELECT auth.uid())
    )
  );

-- Reproduce the production predicate defect before applying RC924.
CREATE POLICY agreements_participant_read
  ON public.agreements
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND COALESCE((((SELECT auth.jwt()) ->> 'is_anonymous')::boolean),false)=false
    AND (
      private.legal_is_admin((SELECT auth.uid()))
      OR EXISTS (
        SELECT 1 FROM public.agreement_participants ap
        WHERE ap.agreement_id = ap.id
          AND ap.user_id = (SELECT auth.uid())
      )
    )
  );

-- Reproduce the existing production FOR ALL admin policy: it is permissive
-- for SELECT too, so a separate RESTRICTIVE confirmed-auth guard is required.
CREATE POLICY agreements_admin_write
  ON public.agreements
  FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND COALESCE((((SELECT auth.jwt()) ->> 'is_anonymous')::boolean),false)=false
    AND private.legal_is_admin((SELECT auth.uid()))
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND COALESCE((((SELECT auth.jwt()) ->> 'is_anonymous')::boolean),false)=false
    AND private.legal_is_admin((SELECT auth.uid()))
  );

-- Match the restrictive anonymous-auth boundaries observed in Production.
CREATE POLICY mnt_non_anonymous_boundary
  ON public.agreements AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean),false)=false)
  WITH CHECK (COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean),false)=false);
CREATE POLICY non_anonymous_authenticated_guard
  ON public.agreements AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
  WITH CHECK (COALESCE((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

CREATE POLICY mnt_non_anonymous_boundary
  ON public.agreement_participants AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean),false)=false)
  WITH CHECK (COALESCE(((auth.jwt() ->> 'is_anonymous')::boolean),false)=false);

GRANT USAGE ON SCHEMA public,auth,private TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.legal_is_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.legal_is_admin(uuid) TO authenticated;
GRANT SELECT ON public.agreements,public.agreement_participants TO authenticated;
