-- RC466 behavioral integration tests. Run only in disposable PostgreSQL.
SET ROLE authenticated;

DO $test$
DECLARE
  v_businesses uuid[];
  v_branches text[];
  v_expected_businesses uuid[];
  v_expected_branches text[];
BEGIN
  -- Fully unscoped tenant OWNER retains tenant-wide visibility, but not other tenants.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  v_expected_businesses := ARRAY[
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003'
  ]::uuid[];
  v_expected_branches := ARRAY['branch-a1','branch-a2','branch-b1','branch-c1']::text[];
  IF v_businesses IS DISTINCT FROM v_expected_businesses OR v_branches IS DISTINCT FROM v_expected_branches THEN
    RAISE EXCEPTION 'TEST_FAILED: unscoped OWNER must see tenant-a only; got % / %',v_businesses,v_branches;
  END IF;

  -- Branch-scoped OWNER sees only its business and assigned branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  v_expected_businesses := ARRAY['20000000-0000-4000-8000-000000000001']::uuid[];
  v_expected_branches := ARRAY['branch-a1']::text[];
  IF v_businesses IS DISTINCT FROM v_expected_businesses OR v_branches IS DISTINCT FROM v_expected_branches THEN
    RAISE EXCEPTION 'TEST_FAILED: scoped OWNER crossed business/branch boundary; got % / %',v_businesses,v_branches;
  END IF;

  -- Business-level MANAGER sees all branches in its business, not other businesses.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  v_expected_branches := ARRAY['branch-a1','branch-a2']::text[];
  IF v_businesses IS DISTINCT FROM ARRAY['20000000-0000-4000-8000-000000000001']::uuid[]
     OR v_branches IS DISTINCT FROM v_expected_branches THEN
    RAISE EXCEPTION 'TEST_FAILED: business-level MANAGER crossed business boundary; got % / %',v_businesses,v_branches;
  END IF;

  -- Branch-scoped MANAGER is restricted to the assigned branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS DISTINCT FROM ARRAY['20000000-0000-4000-8000-000000000001']::uuid[]
     OR v_branches IS DISTINCT FROM ARRAY['branch-a1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch-scoped MANAGER crossed scope; got % / %',v_businesses,v_branches;
  END IF;

  -- BUSINESS_OWNER with a branch assignment sees only its business and branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS DISTINCT FROM ARRAY['20000000-0000-4000-8000-000000000001']::uuid[]
     OR v_branches IS DISTINCT FROM ARRAY['branch-a1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: BUSINESS_OWNER crossed scope; got % / %',v_businesses,v_branches;
  END IF;

  -- Inactive memberships cannot read businesses or branches.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000006',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS NOT NULL OR v_branches IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: inactive membership received business/branch visibility; got % / %',v_businesses,v_branches;
  END IF;

  -- An unscoped CUSTOMER is not a tenant administrator and cannot enumerate private business/branch rows.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS NOT NULL OR v_branches IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: unscoped CUSTOMER received private business/branch visibility; got % / %',v_businesses,v_branches;
  END IF;

  -- Unscoped EMPLOYEE is not granted tenant-wide business/branch enumeration.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000009',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS NOT NULL OR v_branches IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: unscoped EMPLOYEE received tenant-wide visibility; got % / %',v_businesses,v_branches;
  END IF;

  -- Tenant-B manager sees only tenant-B business and branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS DISTINCT FROM ARRAY['20000000-0000-4000-8000-000000000004']::uuid[]
     OR v_branches IS DISTINCT FROM ARRAY['branch-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant-B manager crossed tenant boundary; got % / %',v_businesses,v_branches;
  END IF;

  -- A SUPER_ADMIN role/permission payload alone is not platform authority.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000011',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000011","role":"authenticated","is_anonymous":false}',false);
  IF EXISTS (SELECT 1 FROM public.businesses) OR EXISTS (SELECT 1 FROM public.branches)
     OR EXISTS (SELECT 1 FROM public.departments) OR EXISTS (SELECT 1 FROM public.warehouses)
     OR EXISTS (SELECT 1 FROM public.stock_balances) OR EXISTS (SELECT 1 FROM public.inventory_transactions) THEN
    RAISE EXCEPTION 'TEST_FAILED: noncanonical SUPER_ADMIN role bypassed the platform registry';
  END IF;

  -- Only the canonical private.platform_admins registry grants global platform visibility.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000010","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS DISTINCT FROM ARRAY[
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000004'
    ]::uuid[]
    OR v_branches IS DISTINCT FROM ARRAY['branch-a1','branch-a2','branch-b1','branch-c1','branch-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: canonical platform registry business/branch scope incorrect; got % / %',v_businesses,v_branches;
  END IF;

  -- Anonymous sessions cannot use authenticated read policies.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',false);
  SELECT array_agg(id ORDER BY id) INTO v_businesses FROM public.businesses;
  SELECT array_agg(id ORDER BY id) INTO v_branches FROM public.branches;
  IF v_businesses IS NOT NULL OR v_branches IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FAILED: anonymous session received business/branch visibility; got % / %',v_businesses,v_branches;
  END IF;

  IF pg_catalog.has_table_privilege(current_user,'public.businesses','INSERT')
     OR pg_catalog.has_table_privilege(current_user,'public.businesses','UPDATE')
     OR pg_catalog.has_table_privilege(current_user,'public.businesses','DELETE')
     OR pg_catalog.has_table_privilege(current_user,'public.branches','INSERT')
     OR pg_catalog.has_table_privilege(current_user,'public.branches','UPDATE')
     OR pg_catalog.has_table_privilege(current_user,'public.branches','DELETE') THEN
    RAISE EXCEPTION 'TEST_FAILED: RC466 unexpectedly granted client writes';
  END IF;
END;
$test$;

DO $inventory_test$
DECLARE
  v_ids text[];
  v_rows integer;
BEGIN
  -- Unscoped tenant OWNER retains all tenant-a department and inventory visibility.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-a1','dept-a2','dept-a-shared','dept-b1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant OWNER department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-a1','warehouse-a2','warehouse-a-shared','warehouse-b1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant OWNER warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-a1','stock-a2','stock-a-shared','stock-b1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant OWNER stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-a1','txn-a2','txn-a-shared','txn-b1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant OWNER inventory transaction scope incorrect; got %',v_ids;
  END IF;

  -- Branch-scoped OWNER sees its branch plus business-wide shared resources only.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-a1','dept-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch OWNER department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-a1','warehouse-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch OWNER warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-a1','stock-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch OWNER stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-a1','txn-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch OWNER inventory transaction scope incorrect; got %',v_ids;
  END IF;

  -- Business-level MANAGER sees all resources in business A, not business B.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-a1','dept-a2','dept-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: business manager department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-a1','warehouse-a2','warehouse-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: business manager warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-a1','stock-a2','stock-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: business manager stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-a1','txn-a2','txn-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: business manager inventory scope incorrect; got %',v_ids;
  END IF;

  -- Branch manager and BUSINESS_OWNER memberships remain limited to branch-a1 plus shared rows.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-a1','dept-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch manager department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-a1','warehouse-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch manager warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-a1','stock-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch manager stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-a1','txn-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: branch manager inventory scope incorrect; got %',v_ids;
  END IF;

  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-a1','dept-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: BUSINESS_OWNER department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-a1','warehouse-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: BUSINESS_OWNER warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-a1','stock-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: BUSINESS_OWNER stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-a1','txn-a-shared']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: BUSINESS_OWNER inventory transaction scope incorrect; got %',v_ids;
  END IF;

  -- A different tenant manager sees only its own tenant resources.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000007',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant-B department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant-B warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant-B stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: tenant-B inventory transaction scope incorrect; got %',v_ids;
  END IF;

  -- Customers and unscoped employees must not enumerate private inventory.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated","is_anonymous":false}',false);
  IF EXISTS (SELECT 1 FROM public.departments) OR EXISTS (SELECT 1 FROM public.warehouses)
     OR EXISTS (SELECT 1 FROM public.stock_balances) OR EXISTS (SELECT 1 FROM public.inventory_transactions) THEN
    RAISE EXCEPTION 'TEST_FAILED: unscoped CUSTOMER received private inventory visibility';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000009',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000009","role":"authenticated","is_anonymous":false}',false);
  IF EXISTS (SELECT 1 FROM public.departments) OR EXISTS (SELECT 1 FROM public.warehouses)
     OR EXISTS (SELECT 1 FROM public.stock_balances) OR EXISTS (SELECT 1 FROM public.inventory_transactions) THEN
    RAISE EXCEPTION 'TEST_FAILED: unscoped EMPLOYEE received private inventory visibility';
  END IF;

  -- Canonical platform-root registry retains tenant-wide read access.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000010',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000010","role":"authenticated","is_anonymous":false}',false);
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.departments;
  IF v_ids IS DISTINCT FROM ARRAY['dept-a1','dept-a2','dept-a-shared','dept-b1','dept-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: canonical platform admin department scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.warehouses;
  IF v_ids IS DISTINCT FROM ARRAY['warehouse-a1','warehouse-a2','warehouse-a-shared','warehouse-b1','warehouse-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: canonical platform admin warehouse scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.stock_balances;
  IF v_ids IS DISTINCT FROM ARRAY['stock-a1','stock-a2','stock-a-shared','stock-b1','stock-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: canonical platform admin stock scope incorrect; got %',v_ids;
  END IF;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.inventory_transactions;
  IF v_ids IS DISTINCT FROM ARRAY['txn-a1','txn-a2','txn-a-shared','txn-b1','txn-d1']::text[] THEN
    RAISE EXCEPTION 'TEST_FAILED: canonical platform admin inventory transaction scope incorrect; got %',v_ids;
  END IF;

  -- Anonymous sessions cannot read inventory.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}',false);
  IF EXISTS (SELECT 1 FROM public.departments) OR EXISTS (SELECT 1 FROM public.warehouses)
     OR EXISTS (SELECT 1 FROM public.stock_balances) OR EXISTS (SELECT 1 FROM public.inventory_transactions) THEN
    RAISE EXCEPTION 'TEST_FAILED: anonymous session received private inventory visibility';
  END IF;

  -- A branch manager may update only its own department and cannot insert into a sibling branch.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","is_anonymous":false}',false);
  UPDATE public.departments SET name='A2 Forbidden Update' WHERE id='dept-a2';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'TEST_FAILED: branch manager updated sibling department';
  END IF;
  UPDATE public.departments SET name='A1 Updated' WHERE id='dept-a1';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: branch manager could not update its own department';
  END IF;

  BEGIN
    INSERT INTO public.departments(id,tenant_id,business_id,branch_id,name,code,status)
    VALUES ('dept-a2-forbidden','tenant-a','20000000-0000-4000-8000-000000000001','branch-a2','Forbidden','AF','ACTIVE');
    RAISE EXCEPTION 'TEST_FAILED: branch manager inserted sibling department';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$inventory_test$;

RESET ROLE;

-- Exercise actual PostgreSQL anon grants separately from an authenticated
-- session carrying is_anonymous=true. The current live ACL intentionally
-- gives anon no direct SELECT or write grants on either relation.
SET ROLE anon;
DO $anon_boundary$
BEGIN
  IF pg_catalog.has_table_privilege(current_user, 'public.businesses', 'SELECT')
     OR pg_catalog.has_table_privilege(current_user, 'public.branches', 'SELECT')
     OR pg_catalog.has_table_privilege(current_user, 'public.businesses', 'INSERT,UPDATE,DELETE')
     OR pg_catalog.has_table_privilege(current_user, 'public.branches', 'INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'TEST_FAILED: anon has direct business/branch table privileges';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname='public'
      AND tablename='branches'
      AND cmd IN ('SELECT','ALL')
      AND roles && ARRAY['anon','public']::name[]
  ) THEN
    RAISE EXCEPTION 'TEST_FAILED: a public/anon branch SELECT policy remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname='public'
      AND tablename='businesses'
      AND policyname='Public can view official showcase businesses'
      AND roles && ARRAY['anon']::name[]
  ) THEN
    RAISE EXCEPTION 'TEST_FAILED: official showcase policy was not preserved';
  END IF;
END;
$anon_boundary$;
RESET ROLE;

SELECT 'RC466 business/branch read scope: PASS' AS result;
