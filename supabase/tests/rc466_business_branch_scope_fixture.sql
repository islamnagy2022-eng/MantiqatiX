-- Disposable PostgreSQL fixture for RC466 business/branch scope.
-- Synthetic rows only; no connection to the live Supabase project.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$function$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;

CREATE TABLE public.user_memberships (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id text NOT NULL,
  business_id uuid,
  branch_id text,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  permissions jsonb
);
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.branches (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
);

ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_select_self
ON public.user_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Reproduce the live tenant-wide businesses read policy.
CREATE POLICY businesses_member_select
ON public.businesses FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=businesses.tenant_id::text
      AND um.status='ACTIVE'
  )
);
CREATE POLICY "Public can view official showcase businesses"
ON public.businesses FOR SELECT TO anon,authenticated
USING (status='ACTIVE' AND coalesce(settings ->> 'showcase','false')='true');
CREATE POLICY businesses_manager_insert
ON public.businesses FOR INSERT TO authenticated
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=businesses.tenant_id::text
      AND um.status='ACTIVE'
      AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
);
CREATE POLICY businesses_manager_update
ON public.businesses FOR UPDATE TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=businesses.tenant_id::text
      AND um.status='ACTIVE'
      AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=businesses.tenant_id::text
      AND um.status='ACTIVE'
      AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
);
CREATE POLICY businesses_manager_delete
ON public.businesses FOR DELETE TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=businesses.tenant_id::text
      AND um.status='ACTIVE'
      AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
);

-- Reproduce the live tenant-only branch read and broad permissive ALL guards.
CREATE POLICY branches_member_read
ON public.branches FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=branches.tenant_id::text
      AND um.status='ACTIVE'
  )
);
CREATE POLICY branches_manager_write
ON public.branches FOR ALL TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=branches.tenant_id::text
      AND um.status='ACTIVE'
      AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=branches.tenant_id::text
      AND um.status='ACTIVE'
      AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
);
CREATE POLICY branches_super_admin_write
ON public.branches FOR ALL TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=branches.tenant_id::text
      AND um.status='ACTIVE'
      AND upper(um.role)='SUPER_ADMIN'
      AND coalesce(um.permissions ->> 'scope','')='PLATFORM'
      AND coalesce((um.permissions ->> 'full_control')::boolean,false)=true
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid()
      AND um.tenant_id::text=branches.tenant_id::text
      AND um.status='ACTIVE'
      AND upper(um.role)='SUPER_ADMIN'
      AND coalesce(um.permissions ->> 'scope','')='PLATFORM'
      AND coalesce((um.permissions ->> 'full_control')::boolean,false)=true
  )
);
CREATE POLICY authenticated_sessions_only
ON public.branches FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY deny_anonymous_users
ON public.branches FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY mnt_non_anonymous_boundary
ON public.branches FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false);
CREATE POLICY non_anonymous_authenticated_guard
ON public.branches FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.businesses,public.branches,public.user_memberships TO authenticated;

INSERT INTO public.businesses(id,tenant_id,name,status,settings) VALUES
 ('20000000-0000-4000-8000-000000000001','tenant-a','Business A','ACTIVE','{}'),
 ('20000000-0000-4000-8000-000000000002','tenant-a','Business B','ACTIVE','{}'),
 ('20000000-0000-4000-8000-000000000003','tenant-a','Business C','ACTIVE','{}'),
 ('20000000-0000-4000-8000-000000000004','tenant-b','Business D','ACTIVE','{}');

INSERT INTO public.branches(id,tenant_id,business_id,name,status) VALUES
 ('branch-a1','tenant-a','20000000-0000-4000-8000-000000000001','A1','ACTIVE'),
 ('branch-a2','tenant-a','20000000-0000-4000-8000-000000000001','A2','ACTIVE'),
 ('branch-b1','tenant-a','20000000-0000-4000-8000-000000000002','B1','ACTIVE'),
 ('branch-c1','tenant-a','20000000-0000-4000-8000-000000000003','C1','ACTIVE'),
 ('branch-d1','tenant-b','20000000-0000-4000-8000-000000000004','D1','ACTIVE');

INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status,permissions) VALUES
 ('unscoped-owner','10000000-0000-4000-8000-000000000001','tenant-a',NULL,NULL,'OWNER','ACTIVE','{}'),
 ('scoped-owner-a1','10000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','OWNER','ACTIVE','{}'),
 ('business-manager-a','10000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'MANAGER','ACTIVE','{}'),
 ('branch-manager-a1','10000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','MANAGER','ACTIVE','{}'),
 ('business-owner-a1','10000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','BUSINESS_OWNER','ACTIVE','{}'),
 ('inactive-manager-a1','10000000-0000-4000-8000-000000000006','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','MANAGER','INACTIVE','{}'),
 ('unscoped-manager-b','10000000-0000-4000-8000-000000000007','tenant-b',NULL,NULL,'MANAGER','ACTIVE','{}'),
 ('unscoped-customer-a','10000000-0000-4000-8000-000000000008','tenant-a',NULL,NULL,'CUSTOMER','ACTIVE','{}'),
 ('unscoped-employee-a','10000000-0000-4000-8000-000000000009','tenant-a',NULL,NULL,'EMPLOYEE','ACTIVE','{}'),
 ('platform-super-admin-a','10000000-0000-4000-8000-000000000010','tenant-a',NULL,NULL,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}');
