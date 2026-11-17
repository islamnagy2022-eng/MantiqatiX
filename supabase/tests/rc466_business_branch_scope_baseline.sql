-- Demonstrate the pre-RC466 tenant-wide branch-read bypass using synthetic data.
SET ROLE authenticated;

DO $baseline$
DECLARE
  v_business_count integer;
  v_branch_count integer;
  v_department_count integer;
  v_warehouse_count integer;
  v_stock_count integer;
  v_inventory_count integer;
BEGIN
  -- A branch-scoped OWNER can see every business and branch in tenant-a before the scope fix.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO v_business_count FROM public.businesses;
  SELECT count(*) INTO v_branch_count FROM public.branches;
  SELECT count(*) INTO v_department_count FROM public.departments;
  SELECT count(*) INTO v_warehouse_count FROM public.warehouses;
  SELECT count(*) INTO v_stock_count FROM public.stock_balances;
  SELECT count(*) INTO v_inventory_count FROM public.inventory_transactions;
  IF v_business_count <> 3 OR v_branch_count <> 4
     OR v_department_count <> 4 OR v_warehouse_count <> 4
     OR v_stock_count <> 4 OR v_inventory_count <> 4 THEN
    RAISE EXCEPTION 'RC466_BASELINE_NOT_REPRODUCED: scoped OWNER expected tenant-wide rows before fix; got businesses %, branches %, departments %, warehouses %, stock %, inventory %',
      v_business_count,v_branch_count,v_department_count,v_warehouse_count,v_stock_count,v_inventory_count;
  END IF;

  -- Even a tenant-level CUSTOMER could enumerate all branches in its tenant through the permissive tenant-only member-read policy.
  PERFORM set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000008',false);
  PERFORM set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000008","role":"authenticated","is_anonymous":false}',false);
  SELECT count(*) INTO v_branch_count FROM public.branches;
  SELECT count(*) INTO v_department_count FROM public.departments;
  SELECT count(*) INTO v_warehouse_count FROM public.warehouses;
  SELECT count(*) INTO v_stock_count FROM public.stock_balances;
  SELECT count(*) INTO v_inventory_count FROM public.inventory_transactions;
  IF v_branch_count <> 4 OR v_department_count <> 4 OR v_warehouse_count <> 4
     OR v_stock_count <> 4 OR v_inventory_count <> 4 THEN
    RAISE EXCEPTION 'RC466_BASELINE_NOT_REPRODUCED: unscoped CUSTOMER expected tenant-wide inventory rows before fix; got branches %, departments %, warehouses %, stock %, inventory %',
      v_branch_count,v_department_count,v_warehouse_count,v_stock_count,v_inventory_count;
  END IF;
END;
$baseline$;

RESET ROLE;
SELECT 'RC466 vulnerable tenant-wide business, branch and inventory baseline reproduced: PASS' AS result;
