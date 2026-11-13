-- RC466: enforce business/branch scope for authenticated reads of businesses and branches.
-- The prior branches ALL policies were permissive and ORed with the scoped read policy.
-- This migration replaces those predicates with explicit hierarchical scope.
-- No table data, table structure, or client grants are changed.

BEGIN;

DO $preflight$
DECLARE
  v_businesses_rls boolean;
  v_branches_rls boolean;
BEGIN
  IF pg_catalog.to_regclass('public.businesses') IS NULL
     OR pg_catalog.to_regclass('public.branches') IS NULL
     OR pg_catalog.to_regclass('public.user_memberships') IS NULL THEN
    RAISE EXCEPTION 'RC466_REQUIRED_TABLE_MISSING';
  END IF;

  SELECT relrowsecurity INTO v_businesses_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.businesses');
  SELECT relrowsecurity INTO v_branches_rls
  FROM pg_catalog.pg_class WHERE oid = pg_catalog.to_regclass('public.branches');

  IF NOT coalesce(v_businesses_rls, false)
     OR NOT coalesce(v_branches_rls, false) THEN
    RAISE EXCEPTION 'RC466_RLS_MUST_REMAIN_ENABLED';
  END IF;

  IF NOT pg_catalog.has_table_privilege('authenticated', 'public.businesses', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.branches', 'SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated', 'public.user_memberships', 'SELECT') THEN
    RAISE EXCEPTION 'RC466_EXPECTED_AUTHENTICATED_READ_GRANTS_MISSING';
  END IF;

  IF pg_catalog.has_table_privilege('anon', 'public.businesses', 'SELECT')
     OR pg_catalog.has_table_privilege('anon', 'public.branches', 'SELECT') THEN
    RAISE EXCEPTION 'RC466_UNEXPECTED_ANON_SELECT_GRANT';
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

-- The old generic session guards were permissive ALL policies. Since permissive
-- policies are ORed, they bypassed the scoped branch-read policy for any authenticated
-- non-anonymous user. They are redundant once the command-specific policies are scoped.
DROP POLICY IF EXISTS authenticated_sessions_only ON public.branches;
DROP POLICY IF EXISTS deny_anonymous_users ON public.branches;
DROP POLICY IF EXISTS mnt_non_anonymous_boundary ON public.branches;
DROP POLICY IF EXISTS non_anonymous_authenticated_guard ON public.branches;

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

COMMIT;
