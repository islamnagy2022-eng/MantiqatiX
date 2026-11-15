-- RC466: enforce business/branch scope for authenticated reads of businesses and branches.
-- The prior branches ALL policies were permissive and ORed with the scoped read policy.
-- This migration replaces those predicates with explicit hierarchical scope.
-- No table data, table structure, or client grants are changed.

BEGIN;

DO $preflight$
DECLARE
  v_businesses_rls boolean;
  v_branches_rls boolean;
  v_departments_rls boolean;
  v_warehouses_rls boolean;
  v_stock_balances_rls boolean;
  v_inventory_transactions_rls boolean;
BEGIN
  IF pg_catalog.to_regclass('public.businesses') IS NULL
     OR pg_catalog.to_regclass('public.branches') IS NULL
     OR pg_catalog.to_regclass('public.user_memberships') IS NULL
     OR pg_catalog.to_regclass('public.departments') IS NULL
     OR pg_catalog.to_regclass('public.warehouses') IS NULL
     OR pg_catalog.to_regclass('public.stock_balances') IS NULL
     OR pg_catalog.to_regclass('public.inventory_transactions') IS NULL THEN
    RAISE EXCEPTION 'RC466_REQUIRED_TABLE_MISSING';
  END IF;

  SELECT relrowsecurity INTO v_businesses_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.businesses');
  SELECT relrowsecurity INTO v_branches_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.branches');
  SELECT relrowsecurity INTO v_departments_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.departments');
  SELECT relrowsecurity INTO v_warehouses_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.warehouses');
  SELECT relrowsecurity INTO v_stock_balances_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.stock_balances');
  SELECT relrowsecurity INTO v_inventory_transactions_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.inventory_transactions');

  IF NOT coalesce(v_businesses_rls, false)
     OR NOT coalesce(v_branches_rls, false)
     OR NOT coalesce(v_departments_rls, false)
     OR NOT coalesce(v_warehouses_rls, false)
     OR NOT coalesce(v_stock_balances_rls, false)
     OR NOT coalesce(v_inventory_transactions_rls, false) THEN
    RAISE EXCEPTION 'RC466_RLS_MUST_REMAIN_ENABLED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.businesses', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.branches', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.user_memberships', 'SELECT') THEN
    RAISE EXCEPTION 'RC466_EXPECTED_AUTHENTICATED_READ_GRANTS_MISSING';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.departments', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.warehouses', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.stock_balances', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.inventory_transactions', 'SELECT') THEN
    RAISE EXCEPTION 'RC466_EXPECTED_INVENTORY_READ_GRANTS_MISSING';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.departments', 'INSERT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.departments', 'UPDATE')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.departments', 'DELETE') THEN
    RAISE EXCEPTION 'RC466_EXPECTED_DEPARTMENT_MANAGER_GRANTS_MISSING';
  END IF;

  -- public.businesses intentionally retains anon SELECT for the official showcase.
  -- Only branches and private inventory tables are required to remain non-public.
  IF pg_catalog.has_table_privilege('anon', 'public.branches', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.departments', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.warehouses', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.stock_balances', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.inventory_transactions', 'SELECT') THEN
    RAISE EXCEPTION 'RC466_UNEXPECTED_ANON_SELECT_GRANT';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_policies
    WHERE schemaname='public'
      AND tablename = ANY (ARRAY['branches','departments','warehouses','stock_balances','inventory_transactions'])
      AND policyname = ANY (ARRAY[
        'authenticated_sessions_only',
        'deny_anonymous_users',
        'mnt_non_anonymous_boundary',
        'non_anonymous_authenticated_guard'
      ])
      AND permissive = 'RESTRICTIVE'
  ) <> 20 THEN
    RAISE EXCEPTION 'RC466_RESTRICTIVE_ANONYMOUS_GUARDS_MUST_BE_PRESERVED';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='branches'
      AND policyname = ANY (ARRAY[
        'authenticated_sessions_only',
        'deny_anonymous_users',
        'mnt_non_anonymous_boundary',
        'non_anonymous_authenticated_guard'
      ])
      AND permissive = 'RESTRICTIVE'
  ) <> 4 THEN
    RAISE EXCEPTION 'RC466_RESTRICTIVE_ANONYMOUS_GUARDS_MUST_BE_PRESERVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='businesses'
      AND policyname='businesses_member_select' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='businesses'
      AND policyname='businesses_manager_insert' AND cmd='INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='businesses'
      AND policyname='businesses_manager_update' AND cmd='UPDATE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='businesses'
      AND policyname='businesses_manager_delete' AND cmd='DELETE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='branches'
      AND policyname='branches_member_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='branches'
      AND policyname='branches_manager_write' AND cmd='ALL'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='branches'
      AND policyname='branches_super_admin_write' AND cmd='ALL'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='departments'
      AND policyname='departments_member_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='departments'
      AND policyname='departments_manager_write' AND cmd='ALL'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='warehouses'
      AND policyname='warehouses_member_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='warehouses'
      AND policyname='warehouses_manager_insert' AND cmd='INSERT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='warehouses'
      AND policyname='warehouses_manager_update' AND cmd='UPDATE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='warehouses'
      AND policyname='warehouses_manager_delete' AND cmd='DELETE'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='stock_balances'
      AND policyname='stock_balances_member_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='inventory_transactions'
      AND policyname='inventory_transactions_member_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename='inventory_transactions'
      AND policyname='inventory_transactions_manager_insert' AND cmd='INSERT'
  ) THEN
    RAISE EXCEPTION 'RC466_EXPECTED_SCOPE_POLICIES_MISSING';
  END IF;
END;
$preflight$;

-- Business rows: only unscoped tenant OWNER/ADMIN/MANAGER or a strict platform
-- SUPER_ADMIN retain tenant-wide visibility; scoped memberships see their business.
DROP POLICY businesses_member_select ON public.businesses;
CREATE POLICY businesses_member_select
ON public.businesses
FOR SELECT
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = businesses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND (
        (um.business_id IS NOT NULL AND um.business_id = businesses.id)
        OR (
          um.business_id IS NULL AND um.branch_id IS NULL
          AND (
            upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
            OR (
              upper(um.role) = 'SUPER_ADMIN'
              AND coalesce(um.permissions ->> 'scope','') = 'PLATFORM'
              AND coalesce((um.permissions ->> 'full_control')::boolean,false) = true
            )
          )
        )
      )
  )
);

-- Business creation is reserved for an unscoped tenant-level OWNER/ADMIN/MANAGER.
DROP POLICY businesses_manager_insert ON public.businesses;
CREATE POLICY businesses_manager_insert
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = businesses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND um.business_id IS NULL
      AND um.branch_id IS NULL
  )
);

DROP POLICY businesses_manager_update ON public.businesses;
CREATE POLICY businesses_manager_update
ON public.businesses
FOR UPDATE
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = businesses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = businesses.id AND um.branch_id IS NULL)
      )
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = businesses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = businesses.id AND um.branch_id IS NULL)
      )
  )
);

DROP POLICY businesses_manager_delete ON public.businesses;
CREATE POLICY businesses_manager_delete
ON public.businesses
FOR DELETE
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = businesses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = businesses.id AND um.branch_id IS NULL)
      )
  )
);

-- Branch reads are hierarchical: approved unscoped tenant managers/platform admins
-- see tenant branches; business scope sees its business; branch scope sees one branch.
DROP POLICY branches_member_read ON public.branches;
CREATE POLICY branches_member_read
ON public.branches
FOR SELECT
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = branches.tenant_id::text
      AND um.status = 'ACTIVE'
      AND (
        (
          um.business_id IS NOT NULL
          AND um.business_id = branches.business_id
          AND (um.branch_id IS NULL OR um.branch_id = branches.id)
        )
        OR (
          um.business_id IS NULL AND um.branch_id IS NULL
          AND (
            upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
            OR (
              upper(um.role) = 'SUPER_ADMIN'
              AND coalesce(um.permissions ->> 'scope','') = 'PLATFORM'
              AND coalesce((um.permissions ->> 'full_control')::boolean,false) = true
            )
          )
        )
      )
  )
);

-- The four generic session guards are RESTRICTIVE in the live database.
-- Preserve them: they only add an anonymous-session boundary and do not grant access.
-- The permissive tenant-wide read and manager ALL policies are the policies narrowed here.

-- The manager policy is ALL in the legacy schema; scope it so its SELECT arm cannot
-- bypass branches_member_read. Existing client write grants remain unchanged (none).
DROP POLICY branches_manager_write ON public.branches;
CREATE POLICY branches_manager_write
ON public.branches
FOR ALL
TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = branches.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (
          um.business_id = branches.business_id
          AND (um.branch_id IS NULL OR um.branch_id = branches.id)
        )
      )
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = branches.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (
          um.business_id = branches.business_id
          AND (um.branch_id IS NULL OR um.branch_id = branches.id)
        )
      )
  )
);

COMMENT ON POLICY businesses_member_select ON public.businesses IS
  'RC466: unscoped tenant managers or strict platform admins may read tenant businesses; scoped memberships are limited to their business.';
COMMENT ON POLICY branches_member_read ON public.branches IS
  'RC466: tenant, business and branch membership scopes are enforced; branch-scoped users cannot enumerate sibling branches.';
COMMENT ON POLICY branches_manager_write ON public.branches IS
  'RC466: legacy ALL policy is retained for compatibility but scoped by tenant/business/branch on both USING and WITH CHECK.';

-- Departments, warehouses, stock balances and inventory transactions also carry
-- business/branch identity. Tenant-only membership checks are insufficient for
-- branch-scoped users, so reads and manager writes inherit the same hierarchy.
DROP POLICY departments_member_read ON public.departments;
CREATE POLICY departments_member_read
ON public.departments FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = departments.tenant_id::text
      AND um.status = 'ACTIVE'
      AND (
        (
          um.business_id = departments.business_id
          AND (um.branch_id IS NULL OR departments.branch_id IS NULL OR um.branch_id = departments.branch_id)
        )
        OR (
          um.business_id IS NULL AND um.branch_id IS NULL
          AND (
            upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
            OR (
              upper(um.role) = 'SUPER_ADMIN'
              AND coalesce(um.permissions ->> 'scope','') = 'PLATFORM'
              AND coalesce((um.permissions ->> 'full_control')::boolean,false) = true
            )
          )
        )
      )
  )
);

DROP POLICY departments_manager_write ON public.departments;
CREATE POLICY departments_manager_write
ON public.departments FOR ALL TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = departments.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (
          um.business_id = departments.business_id
          AND (um.branch_id IS NULL OR um.branch_id = departments.branch_id)
        )
      )
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = departments.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (
          um.business_id = departments.business_id
          AND (um.branch_id IS NULL OR um.branch_id = departments.branch_id)
        )
      )
  )
);

DROP POLICY warehouses_member_read ON public.warehouses;
CREATE POLICY warehouses_member_read
ON public.warehouses FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = warehouses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND (
        (
          um.business_id = warehouses.business_id
          AND (um.branch_id IS NULL OR warehouses.branch_id IS NULL OR um.branch_id = warehouses.branch_id)
        )
        OR (
          um.business_id IS NULL AND um.branch_id IS NULL
          AND (
            upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
            OR (
              upper(um.role) = 'SUPER_ADMIN'
              AND coalesce(um.permissions ->> 'scope','') = 'PLATFORM'
              AND coalesce((um.permissions ->> 'full_control')::boolean,false) = true
            )
          )
        )
      )
  )
);

DROP POLICY warehouses_manager_insert ON public.warehouses;
CREATE POLICY warehouses_manager_insert
ON public.warehouses FOR INSERT TO authenticated
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = warehouses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = warehouses.business_id AND (um.branch_id IS NULL OR um.branch_id = warehouses.branch_id))
      )
  )
);

DROP POLICY warehouses_manager_update ON public.warehouses;
CREATE POLICY warehouses_manager_update
ON public.warehouses FOR UPDATE TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = warehouses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = warehouses.business_id AND (um.branch_id IS NULL OR um.branch_id = warehouses.branch_id))
      )
  )
)
WITH CHECK (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = warehouses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = warehouses.business_id AND (um.branch_id IS NULL OR um.branch_id = warehouses.branch_id))
      )
  )
);

DROP POLICY warehouses_manager_delete ON public.warehouses;
CREATE POLICY warehouses_manager_delete
ON public.warehouses FOR DELETE TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = warehouses.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (um.business_id = warehouses.business_id AND (um.branch_id IS NULL OR um.branch_id = warehouses.branch_id))
      )
  )
);

DROP POLICY stock_balances_member_read ON public.stock_balances;
CREATE POLICY stock_balances_member_read
ON public.stock_balances FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.warehouses w
    WHERE w.id = stock_balances.warehouse_id
      AND w.tenant_id::text = stock_balances.tenant_id::text
      AND w.business_id = stock_balances.business_id
      AND w.branch_id IS NOT DISTINCT FROM stock_balances.branch_id
  )
);

DROP POLICY inventory_transactions_member_read ON public.inventory_transactions;
CREATE POLICY inventory_transactions_member_read
ON public.inventory_transactions FOR SELECT TO authenticated
USING (
  coalesce((auth.jwt() ->> 'is_anonymous'), 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = inventory_transactions.tenant_id::text
      AND um.status = 'ACTIVE'
      AND (
        (
          um.business_id = inventory_transactions.business_id
          AND (um.branch_id IS NULL OR inventory_transactions.branch_id IS NULL OR um.branch_id = inventory_transactions.branch_id)
        )
        OR (
          um.business_id IS NULL AND um.branch_id IS NULL
          AND (
            upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
            OR (
              upper(um.role) = 'SUPER_ADMIN'
              AND coalesce(um.permissions ->> 'scope','') = 'PLATFORM'
              AND coalesce((um.permissions ->> 'full_control')::boolean,false) = true
            )
          )
        )
      )
  )
  AND (
    inventory_transactions.warehouse_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = inventory_transactions.warehouse_id
        AND w.tenant_id::text = inventory_transactions.tenant_id::text
        AND w.business_id = inventory_transactions.business_id
        AND w.branch_id IS NOT DISTINCT FROM inventory_transactions.branch_id
    )
  )
);

DROP POLICY inventory_transactions_manager_insert ON public.inventory_transactions;
CREATE POLICY inventory_transactions_manager_insert
ON public.inventory_transactions FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_memberships um
    WHERE um.user_id = auth.uid()
      AND um.tenant_id::text = inventory_transactions.tenant_id::text
      AND um.status = 'ACTIVE'
      AND upper(um.role) = ANY (ARRAY['OWNER','ADMIN','MANAGER'])
      AND (
        (um.business_id IS NULL AND um.branch_id IS NULL)
        OR (
          um.business_id = inventory_transactions.business_id
          AND um.branch_id IS NOT NULL
          AND um.branch_id = inventory_transactions.branch_id
        )
        OR (
          um.business_id = inventory_transactions.business_id
          AND um.branch_id IS NULL
        )
      )
  )
  AND (
    inventory_transactions.warehouse_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = inventory_transactions.warehouse_id
        AND w.tenant_id::text = inventory_transactions.tenant_id::text
        AND w.business_id = inventory_transactions.business_id
        AND w.branch_id IS NOT DISTINCT FROM inventory_transactions.branch_id
    )
  )
);

COMMENT ON POLICY departments_member_read ON public.departments IS
  'RC466: department reads inherit exact business/branch membership scope.';
COMMENT ON POLICY departments_manager_write ON public.departments IS
  'RC466: department management is limited to tenant, business and branch scope on USING and WITH CHECK.';
COMMENT ON POLICY warehouses_member_read ON public.warehouses IS
  'RC466: warehouse reads inherit exact business/branch membership scope.';
COMMENT ON POLICY warehouses_manager_insert ON public.warehouses IS
  'RC466: warehouse creation is limited to tenant, business and branch scope.';
COMMENT ON POLICY warehouses_manager_update ON public.warehouses IS
  'RC466: warehouse updates are limited to tenant, business and branch scope.';
COMMENT ON POLICY warehouses_manager_delete ON public.warehouses IS
  'RC466: warehouse deletion is limited to tenant, business and branch scope.';
COMMENT ON POLICY stock_balances_member_read ON public.stock_balances IS
  'RC466: stock balances are visible only through an authorized parent warehouse.';
COMMENT ON POLICY inventory_transactions_member_read ON public.inventory_transactions IS
  'RC466: inventory transaction reads inherit exact business/branch membership and parent warehouse visibility.';
COMMENT ON POLICY inventory_transactions_manager_insert ON public.inventory_transactions IS
  'RC466: future inventory writes require the acting manager, exact business/branch and a matching warehouse when supplied.';

COMMIT;
