-- Disposable PostgreSQL fixture for RC465 order SELECT scope.
-- Contains synthetic records only; never points at Production.

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END;
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
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
  status text NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  branch_id text,
  customer_id uuid NOT NULL,
  assigned_partner_id uuid,
  status text NOT NULL DEFAULT 'PENDING'
);

CREATE TABLE public.order_status_history (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  business_id uuid NOT NULL,
  branch_id text,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_select_self
ON public.user_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Reproduce the pre-RC465 tenant-wide member policy.
CREATE POLICY orders_member_select
ON public.orders FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = orders.tenant_id::text
      AND m.status = 'ACTIVE'
  )
  AND (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_memberships m2
      WHERE m2.user_id = auth.uid()
        AND m2.tenant_id::text = orders.tenant_id::text
        AND m2.status = 'ACTIVE'
        AND m2.role = ANY(ARRAY['OWNER','ADMIN','MANAGER','STAFF','EMPLOYEE','FINANCE','ACCOUNTANT','FINANCE_MANAGER'])
    )
    OR (
      assigned_partner_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.user_memberships mp
        WHERE mp.user_id = auth.uid()
          AND mp.tenant_id::text = orders.tenant_id::text
          AND mp.status = 'ACTIVE'
      )
    )
  )
);

CREATE POLICY orders_provider_select_own_business
ON public.orders FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.user_id = auth.uid()
      AND m.tenant_id::text = orders.tenant_id::text
      AND m.business_id = orders.business_id
      AND m.status = 'ACTIVE'
      AND upper(m.role) = 'SERVICE_PROVIDER'
  )
);

CREATE POLICY orders_customer_select_own
ON public.orders FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND customer_id = auth.uid()
);

-- Reproduce the live pre-RC465 broad permissive policies on order history.
CREATE POLICY authenticated_sessions_only
ON public.order_status_history FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

CREATE POLICY deny_anonymous_users
ON public.order_status_history FOR ALL TO authenticated
USING (coalesce((SELECT auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
WITH CHECK (coalesce((SELECT auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

CREATE POLICY mnt_non_anonymous_boundary
ON public.order_status_history FOR ALL TO authenticated
USING (coalesce(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false)
WITH CHECK (coalesce(((auth.jwt() ->> 'is_anonymous')::boolean), false) = false);

CREATE POLICY non_anonymous_authenticated_guard
ON public.order_status_history FOR ALL TO authenticated
USING (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true')
WITH CHECK (coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true');

CREATE POLICY order_status_history_customer_select_own
ON public.order_status_history FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.customer_id = auth.uid()
  )
);

CREATE POLICY order_status_history_manager_insert
ON public.order_status_history FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = (SELECT auth.uid())
      AND um.tenant_id::text = order_status_history.tenant_id::text
      AND um.status = 'ACTIVE'
      AND um.role = ANY(ARRAY['OWNER','ADMIN','MANAGER'])
  )
  AND changed_by = (SELECT auth.uid())
);

CREATE POLICY order_status_history_member_read
ON public.order_status_history FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = (SELECT auth.uid())
      AND um.tenant_id::text = order_status_history.tenant_id::text
      AND um.status = 'ACTIVE'
  )
);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.orders, public.user_memberships, public.order_status_history TO authenticated;

INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status) VALUES
 ('unscoped-owner','10000000-0000-4000-8000-000000000001','tenant-a',NULL,NULL,'OWNER','ACTIVE'),
 ('scoped-owner-a','10000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','OWNER','ACTIVE'),
 ('business-owner-a','10000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','BUSINESS_OWNER','ACTIVE'),
 ('manager-a','10000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','MANAGER','ACTIVE'),
 ('provider-a','10000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','SERVICE_PROVIDER','ACTIVE'),
 ('business-owner-a-unbranched','10000000-0000-4000-8000-000000000007','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'BUSINESS_OWNER','ACTIVE'),
 ('inactive-manager-a','10000000-0000-4000-8000-000000000008','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','MANAGER','INACTIVE'),
 ('scoped-owner-b','10000000-0000-4000-8000-000000000009','tenant-a','20000000-0000-4000-8000-000000000002','branch-c','OWNER','ACTIVE');

INSERT INTO public.orders(id,tenant_id,business_id,branch_id,customer_id,assigned_partner_id,status) VALUES
 ('30000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000005','PENDING'),
 ('30000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','10000000-0000-4000-8000-000000000006',NULL,'PENDING'),
 ('30000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000002','branch-c','10000000-0000-4000-8000-000000000006',NULL,'PENDING'),
 ('30000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000005','PENDING'),
 ('30000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000005','PENDING'),
 ('30000000-0000-4000-8000-000000000006','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'10000000-0000-4000-8000-000000000006',NULL,'PENDING'),
 ('30000000-0000-4000-8000-000000000007','tenant-b','20000000-0000-4000-8000-000000000003','branch-x','10000000-0000-4000-8000-000000000006',NULL,'PENDING');

INSERT INTO public.order_status_history(id,tenant_id,business_id,branch_id,order_id,old_status,new_status,changed_by,reason) VALUES
 ('40000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','30000000-0000-4000-8000-000000000001','NEW','PENDING',NULL,'fixture'),
 ('40000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','30000000-0000-4000-8000-000000000002','NEW','PENDING',NULL,'fixture'),
 ('40000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000002','branch-c','30000000-0000-4000-8000-000000000003','NEW','PENDING',NULL,'fixture'),
 ('40000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','30000000-0000-4000-8000-000000000004','NEW','PENDING',NULL,'fixture'),
 ('40000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','30000000-0000-4000-8000-000000000005','NEW','PENDING',NULL,'fixture'),
 ('40000000-0000-4000-8000-000000000006','tenant-a','20000000-0000-4000-8000-000000000001',NULL,'30000000-0000-4000-8000-000000000006','NEW','PENDING',NULL,'fixture'),
 ('40000000-0000-4000-8000-000000000007','tenant-b','20000000-0000-4000-8000-000000000003','branch-x','30000000-0000-4000-8000-000000000007','NEW','PENDING',NULL,'fixture');
