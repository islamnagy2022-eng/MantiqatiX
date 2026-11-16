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

CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.platform_admins (
  user_id uuid PRIMARY KEY
);
ALTER TABLE private.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.platform_admins FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mnty_can_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.platform_admins pa
    WHERE pa.user_id = auth.uid()
  )
$function$;
REVOKE ALL ON FUNCTION public.mnty_can_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mnty_can_platform_admin() TO authenticated;

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
CREATE TABLE public.departments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  branch_id text,
  name text NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE public.warehouses (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  branch_id text,
  name text NOT NULL,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
);
CREATE TABLE public.stock_balances (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  branch_id text,
  warehouse_id text NOT NULL REFERENCES public.warehouses(id),
  product_id uuid NOT NULL,
  quantity_on_hand numeric NOT NULL DEFAULT 0,
  quantity_reserved numeric NOT NULL DEFAULT 0
);
CREATE TABLE public.inventory_transactions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  branch_id text,
  warehouse_id text REFERENCES public.warehouses(id),
  product_id uuid NOT NULL,
  transaction_type text NOT NULL,
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

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

-- Reproduce the live tenant-only branch read and RESTRICTIVE anonymous-session guards.
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
ON public.branches AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY deny_anonymous_users
ON public.branches AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY mnt_non_anonymous_boundary
ON public.branches AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false);
CREATE POLICY non_anonymous_authenticated_guard
ON public.branches AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

-- Department, warehouse and inventory policies reproduce the live tenant-only baseline.
CREATE POLICY departments_member_read
ON public.departments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=departments.tenant_id::text AND um.status='ACTIVE'
));
CREATE POLICY departments_manager_write
ON public.departments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=departments.tenant_id::text
    AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=departments.tenant_id::text
    AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
));

CREATE POLICY warehouses_member_read
ON public.warehouses FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=warehouses.tenant_id::text AND um.status='ACTIVE'
));
CREATE POLICY warehouses_manager_insert
ON public.warehouses FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=warehouses.tenant_id::text
    AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
));
CREATE POLICY warehouses_manager_update
ON public.warehouses FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=warehouses.tenant_id::text
    AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=warehouses.tenant_id::text
    AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
));
CREATE POLICY warehouses_manager_delete
ON public.warehouses FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=warehouses.tenant_id::text
    AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
));

CREATE POLICY stock_balances_member_read
ON public.stock_balances FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=stock_balances.tenant_id::text AND um.status='ACTIVE'
));

CREATE POLICY inventory_transactions_member_read
ON public.inventory_transactions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_memberships um
  WHERE um.user_id=auth.uid() AND um.tenant_id::text=inventory_transactions.tenant_id::text AND um.status='ACTIVE'
));
CREATE POLICY inventory_transactions_manager_insert
ON public.inventory_transactions FOR INSERT TO authenticated
WITH CHECK (
  created_by=auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id=auth.uid() AND um.tenant_id::text=inventory_transactions.tenant_id::text
      AND um.status='ACTIVE' AND um.role=ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
);

-- Preserve the live restrictive anonymous-session guards on each new table.
CREATE POLICY authenticated_sessions_only ON public.departments AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY deny_anonymous_users ON public.departments AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY mnt_non_anonymous_boundary ON public.departments AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false);
CREATE POLICY non_anonymous_authenticated_guard ON public.departments AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

CREATE POLICY authenticated_sessions_only ON public.warehouses AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY deny_anonymous_users ON public.warehouses AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY mnt_non_anonymous_boundary ON public.warehouses AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false);
CREATE POLICY non_anonymous_authenticated_guard ON public.warehouses AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

CREATE POLICY authenticated_sessions_only ON public.stock_balances AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY deny_anonymous_users ON public.stock_balances AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY mnt_non_anonymous_boundary ON public.stock_balances AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false);
CREATE POLICY non_anonymous_authenticated_guard ON public.stock_balances AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

CREATE POLICY authenticated_sessions_only ON public.inventory_transactions AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY deny_anonymous_users ON public.inventory_transactions AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');
CREATE POLICY mnt_non_anonymous_boundary ON public.inventory_transactions AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous'))::boolean,false)=false);
CREATE POLICY non_anonymous_authenticated_guard ON public.inventory_transactions AS RESTRICTIVE FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'),'false') <> 'true');

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.businesses,public.branches,public.user_memberships,
  public.departments,public.warehouses,public.stock_balances,public.inventory_transactions TO authenticated;
GRANT INSERT,UPDATE,DELETE ON public.departments TO authenticated;

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

INSERT INTO public.departments(id,tenant_id,business_id,branch_id,name,code,status) VALUES
 ('dept-a1','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','A1 Department','A1','ACTIVE'),
 ('dept-a2','tenant-a','20000000-0000-4000-8000-000000000001','branch-a2','A2 Department','A2','ACTIVE'),
 ('dept-a-shared','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'A Shared Department','AS','ACTIVE'),
 ('dept-b1','tenant-a','20000000-0000-4000-8000-000000000002','branch-b1','B1 Department','B1','ACTIVE'),
 ('dept-d1','tenant-b','20000000-0000-4000-8000-000000000004','branch-d1','D1 Department','D1','ACTIVE');

INSERT INTO public.warehouses(id,tenant_id,business_id,branch_id,name,code,status) VALUES
 ('warehouse-a1','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','A1 Warehouse','WA1','ACTIVE'),
 ('warehouse-a2','tenant-a','20000000-0000-4000-8000-000000000001','branch-a2','A2 Warehouse','WA2','ACTIVE'),
 ('warehouse-a-shared','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'A Shared Warehouse','WAS','ACTIVE'),
 ('warehouse-b1','tenant-a','20000000-0000-4000-8000-000000000002','branch-b1','B1 Warehouse','WB1','ACTIVE'),
 ('warehouse-d1','tenant-b','20000000-0000-4000-8000-000000000004','branch-d1','D1 Warehouse','WD1','ACTIVE');

INSERT INTO public.stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved) VALUES
 ('stock-a1','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','warehouse-a1','50000000-0000-4000-8000-000000000001',10,1),
 ('stock-a2','tenant-a','20000000-0000-4000-8000-000000000001','branch-a2','warehouse-a2','50000000-0000-4000-8000-000000000001',20,2),
 ('stock-a-shared','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'warehouse-a-shared','50000000-0000-4000-8000-000000000001',30,3),
 ('stock-b1','tenant-a','20000000-0000-4000-8000-000000000002','branch-b1','warehouse-b1','50000000-0000-4000-8000-000000000001',40,4),
 ('stock-d1','tenant-b','20000000-0000-4000-8000-000000000004','branch-d1','warehouse-d1','50000000-0000-4000-8000-000000000001',50,5);

INSERT INTO public.inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,created_by) VALUES
 ('txn-a1','tenant-a','20000000-0000-4000-8000-000000000001','branch-a1','warehouse-a1','50000000-0000-4000-8000-000000000001','IN',10,5,'10000000-0000-4000-8000-000000000004'),
 ('txn-a2','tenant-a','20000000-0000-4000-8000-000000000001','branch-a2','warehouse-a2','50000000-0000-4000-8000-000000000001','IN',20,5,'10000000-0000-4000-8000-000000000003'),
 ('txn-a-shared','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'warehouse-a-shared','50000000-0000-4000-8000-000000000001','IN',30,5,'10000000-0000-4000-8000-000000000003'),
 ('txn-b1','tenant-a','20000000-0000-4000-8000-000000000002','branch-b1','warehouse-b1','50000000-0000-4000-8000-000000000001','IN',40,5,'10000000-0000-4000-8000-000000000003'),
 ('txn-d1','tenant-b','20000000-0000-4000-8000-000000000004','branch-d1','warehouse-d1','50000000-0000-4000-8000-000000000001','IN',50,5,'10000000-0000-4000-8000-000000000007');

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
 ('noncanonical-super-admin-a','10000000-0000-4000-8000-000000000011','tenant-a',NULL,NULL,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}');

INSERT INTO private.platform_admins(user_id)
VALUES ('10000000-0000-4000-8000-000000000010')
ON CONFLICT (user_id) DO NOTHING;
