-- Behavioral authorization checks for the real RC113-RC115 RPC definitions.
-- Runs only against a disposable PostgreSQL 16 database seeded by the companion fixture.
\set ON_ERROR_STOP on

INSERT INTO public.tenants(id) VALUES ('tenant-a'), ('tenant-b');

INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data) VALUES
('00000000-0000-0000-0000-000000000001','owner-a@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000002','employee-view@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000003','employee-create@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000004','employee-b@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000005','employee-branch@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000006','employee-target@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000007','no-membership@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000008','branch-owner@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000009','tenant-owner@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000010','employee-update@example.test',now(),'{}'),
('00000000-0000-0000-0000-000000000011','finance-override-target@example.test',now(),'{}');

INSERT INTO public.businesses(id,tenant_id,organization_id,name) VALUES
('10000000-0000-0000-0000-000000000001','tenant-a','org-a','Business A'),
('10000000-0000-0000-0000-000000000002','tenant-b','org-b','Business B');

INSERT INTO public.branches(id,tenant_id,business_id) VALUES
('branch-a-1','tenant-a','10000000-0000-0000-0000-000000000001');

INSERT INTO public.user_memberships(id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status) VALUES
('owner-a','00000000-0000-0000-0000-000000000001','tenant-a','org-a','10000000-0000-0000-0000-000000000001',null,'OWNER','{}','ACTIVE'),
('employee-view-a','00000000-0000-0000-0000-000000000002','tenant-a','org-a','10000000-0000-0000-0000-000000000001',null,'EMPLOYEE','{"modules":{"EMPLOYEES":["view"]}}','ACTIVE'),
('employee-create-a','00000000-0000-0000-0000-000000000003','tenant-a','org-a','10000000-0000-0000-0000-000000000001',null,'EMPLOYEE','{"modules":{"EMPLOYEES":["create"]}}','ACTIVE'),
('employee-view-b','00000000-0000-0000-0000-000000000004','tenant-b','org-b','10000000-0000-0000-0000-000000000002',null,'EMPLOYEE','{"modules":{"EMPLOYEES":["view"]}}','ACTIVE'),
('employee-view-branch-a','00000000-0000-0000-0000-000000000005','tenant-a','org-a','10000000-0000-0000-0000-000000000001','branch-a-1','EMPLOYEE','{"modules":{"EMPLOYEES":["view"]}}','ACTIVE'),
('branch-owner-a','00000000-0000-0000-0000-000000000008','tenant-a','org-a','10000000-0000-0000-0000-000000000001','branch-a-1','OWNER','{}','ACTIVE'),
('tenant-owner-a','00000000-0000-0000-0000-000000000009','tenant-a','org-a',null,null,'OWNER','{}','ACTIVE'),
('employee-update-a','00000000-0000-0000-0000-000000000010','tenant-a','org-a','10000000-0000-0000-0000-000000000001',null,'EMPLOYEE','{"modules":{"EMPLOYEES":["update"]}}','ACTIVE');

-- Owner-owned seed rows: no browser role has direct table access.
INSERT INTO public.business_job_positions
  (id,tenant_id,business_id,branch_id,title,description,department,employment_type,permission_template,is_hiring,is_active,created_by,updated_by)
VALUES
  ('20000000-0000-0000-0000-000000000001','tenant-a','10000000-0000-0000-0000-000000000001',null,'Existing role','','Operations','FULL_TIME','{"modules":{"HOME":["view"],"EMPLOYEES":["view"]}}',false,true,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');

INSERT INTO public.business_employees
  (id,tenant_id,business_id,branch_id,user_id,job_position_id,full_name,email,phone,status,permission_overrides,created_by,updated_by)
VALUES
  ('30000000-0000-0000-0000-000000000001','tenant-a','10000000-0000-0000-0000-000000000001',null,'00000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','Existing Employee','employee-target@example.test','','ACTIVE','{}','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');

SET ROLE authenticated;

DO $dashboard_permission_tests$
DECLARE
  v_result jsonb;
  v_id uuid;
  v_elevated_position_id uuid;
  v_elevated_employee_id uuid;
  v_error text;
BEGIN
  -- Direct SELECT stays denied; the UI must use the guarded RPC.
  IF has_table_privilege('authenticated','public.business_job_positions','SELECT')
     OR has_table_privilege('authenticated','public.business_employees','SELECT') THEN
    RAISE EXCEPTION 'DIRECT_EMPLOYEE_TABLE_ACCESS_GRANTED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='business_job_positions' AND c.relrowsecurity AND c.relforcerowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='business_employees' AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'EMPLOYEE_TABLES_MUST_FORCE_RLS';
  END IF;

  -- Business owner may read the business roster through the RPC.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}',true);
  v_result := public.mnty_business_employee_list('tenant-a','10000000-0000-0000-0000-000000000001');
  IF jsonb_array_length(v_result->'positions') <> 1 OR jsonb_array_length(v_result->'employees') <> 1 THEN
    RAISE EXCEPTION 'OWNER_ROSTER_READ_FAILED';
  END IF;
  v_result := public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
  IF jsonb_array_length(v_result->'positions') <> 1 OR jsonb_array_length(v_result->'employees') <> 1 THEN
    RAISE EXCEPTION 'OWNER_SCOPED_ROSTER_READ_FAILED';
  END IF;

  -- A tenant-wide OWNER may administer businesses only inside the same tenant.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000009',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000009","role":"authenticated","is_anonymous":false}',true);
  v_result := public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
  IF jsonb_array_length(v_result->'positions') <> 1 OR jsonb_array_length(v_result->'employees') <> 1 THEN
    RAISE EXCEPTION 'TENANT_OWNER_SCOPED_ROSTER_READ_FAILED';
  END IF;
  v_result := public.mnty_business_employee_list('tenant-a','10000000-0000-0000-0000-000000000001');
  IF jsonb_array_length(v_result->'positions') <> 1 OR jsonb_array_length(v_result->'employees') <> 1 THEN
    RAISE EXCEPTION 'TENANT_OWNER_LEGACY_ROSTER_READ_FAILED';
  END IF;
  v_result := public.mnty_business_employee_position_upsert(
    'tenant-a','10000000-0000-0000-0000-000000000001','Tenant-wide owner position','','','FULL_TIME',
    '{"modules":{"HOME":["view"]}}',false,true,null,null
  );
  v_id := (v_result->>'id')::uuid;
  IF v_id IS NULL THEN RAISE EXCEPTION 'TENANT_WIDE_OWNER_BUSINESS_WRITE_FAILED'; END IF;
  BEGIN
    PERFORM public.mnty_business_employee_list_scoped('tenant-b','10000000-0000-0000-0000-000000000002',null);
    RAISE EXCEPTION 'TENANT_OWNER_CROSS_TENANT_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TENANT_OWNER_CROSS_TENANT_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- An employee with only EMPLOYEES.VIEW can read, but cannot write a position.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated","is_anonymous":false}',true);
  v_result := public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
  IF jsonb_array_length(v_result->'employees') <> 1 THEN
    RAISE EXCEPTION 'VIEW_ONLY_ROSTER_READ_FAILED';
  END IF;
  BEGIN
    PERFORM public.mnty_business_employee_position_upsert(
      'tenant-a','10000000-0000-0000-0000-000000000001','Forbidden by view-only','','','FULL_TIME',
      '{"modules":{"HOME":["view"]}}',false,true,null,null
    );
    RAISE EXCEPTION 'VIEW_ONLY_WRITE_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'VIEW_ONLY_WRITE_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.mnty_business_employee_upsert(
      'tenant-a','10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'Attempted view-only update','employee-target@example.test','',
      '00000000-0000-0000-0000-000000000006','SUSPENDED','{}',null,
      '30000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'VIEW_ONLY_EMPLOYEE_UPDATE_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'VIEW_ONLY_EMPLOYEE_UPDATE_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Explicit CREATE permission may create a position only within the creator's permission ceiling.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated","is_anonymous":false}',true);
  BEGIN
    PERFORM public.mnty_business_employee_position_upsert(
      'tenant-a','10000000-0000-0000-0000-000000000001','Privilege escalation','','','FULL_TIME',
      '{"modules":{"CATALOG":["delete"]}}',false,true,null,null
    );
    RAISE EXCEPTION 'POSITION_PERMISSION_ESCALATION_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'POSITION_PERMISSION_ESCALATION_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('EMPLOYEE_PERMISSION_ESCALATION' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  v_result := public.mnty_business_employee_position_upsert(
    'tenant-a','10000000-0000-0000-0000-000000000001','Allowed scoped role','','','FULL_TIME',
    '{"modules":{"EMPLOYEES":["create"]}}',false,true,null,null
  );
  v_id := (v_result->>'id')::uuid;
  IF v_id IS NULL THEN RAISE EXCEPTION 'ALLOWED_POSITION_CREATE_FAILED'; END IF;

  -- Create-only is not an implicit roster-read permission.
  BEGIN
    PERFORM public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
    RAISE EXCEPTION 'CREATE_ONLY_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'CREATE_ONLY_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Even a permitted creator cannot add FINANCE.MANAGE via per-employee overrides.
  BEGIN
    PERFORM public.mnty_business_employee_upsert(
      'tenant-a','10000000-0000-0000-0000-000000000001',v_id,'Escalation target','escalation-target@example.test','',
      null,'INVITED','{"modules":{"FINANCE":["manage"]}}',null,null
    );
    RAISE EXCEPTION 'EMPLOYEE_OVERRIDE_ESCALATION_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'EMPLOYEE_OVERRIDE_ESCALATION_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('EMPLOYEE_PERMISSION_ESCALATION' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- A branch-scoped OWNER cannot create a whole-business position by omitting branch scope.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000008","role":"authenticated","is_anonymous":false}',true);
  BEGIN
    PERFORM public.mnty_business_employee_position_upsert(
      'tenant-a','10000000-0000-0000-0000-000000000001','Out-of-scope position','','','FULL_TIME',
      '{"modules":{"HOME":["view"]}}',false,true,null,null
    );
    RAISE EXCEPTION 'BRANCH_OWNER_WHOLE_BUSINESS_WRITE_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'BRANCH_OWNER_WHOLE_BUSINESS_WRITE_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  v_result := public.mnty_business_employee_position_upsert(
    'tenant-a','10000000-0000-0000-0000-000000000001','Branch-scoped position','','','FULL_TIME',
    '{"modules":{"HOME":["view"]}}',false,true,'branch-a-1',null
  );
  v_id := (v_result->>'id')::uuid;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_OWNER_SCOPED_POSITION_CREATE_FAILED';
  END IF;
  -- Verify via the protected RPC only; authenticated users must not SELECT the table directly.
  v_result := public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001','branch-a-1');
  IF jsonb_array_length(v_result->'positions') <> 1
     OR v_result->'positions'->0->>'id' <> v_id::text
     OR v_result->'positions'->0->>'title' <> 'Branch-scoped position'
     OR jsonb_array_length(v_result->'employees') <> 0 THEN
    RAISE EXCEPTION 'BRANCH_OWNER_SCOPED_ROSTER_NOT_ISOLATED';
  END IF;

  -- A same-tenant, branch-scoped viewer must not receive the whole-business roster.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000005","role":"authenticated","is_anonymous":false}',true);
  BEGIN
    PERFORM public.mnty_business_employee_list('tenant-a','10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'BRANCH_SCOPED_WHOLE_BUSINESS_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'BRANCH_SCOPED_WHOLE_BUSINESS_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
  -- The legacy RPC is also protected: a branch owner cannot call it to read the full roster.
  BEGIN
    PERFORM public.mnty_business_employee_list('tenant-a','10000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'BRANCH_OWNER_LEGACY_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'BRANCH_OWNER_LEGACY_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  v_result := public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001','branch-a-1');
  IF jsonb_array_length(v_result->'positions') <> 1
     OR v_result->'positions'->0->>'title' <> 'Branch-scoped position'
     OR jsonb_array_length(v_result->'employees') <> 0 THEN
    RAISE EXCEPTION 'BRANCH_VIEWER_SCOPED_ROSTER_NOT_ISOLATED';
  END IF;

  -- An employee from tenant B cannot invoke the roster RPC for tenant A.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000004',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated","is_anonymous":false}',true);
  BEGIN
    PERFORM public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
    RAISE EXCEPTION 'CROSS_TENANT_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'CROSS_TENANT_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Authenticated identities with no active membership are not granted scoped access.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000007","role":"authenticated","is_anonymous":false}',true);
  BEGIN
    PERFORM public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
    RAISE EXCEPTION 'UNASSIGNED_USER_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'UNASSIGNED_USER_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('BUSINESS_HR_FORBIDDEN' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Narrowing a position must revoke stale per-employee overrides before membership synchronization.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":false}',true);
  v_result := public.mnty_business_employee_position_upsert(
    'tenant-a','10000000-0000-0000-0000-000000000001','Finance-capable position','','','FULL_TIME',
    '{"modules":{"FINANCE":["manage"],"EMPLOYEES":["view"]}}',false,true,null,null
  );
  v_elevated_position_id := (v_result->>'id')::uuid;
  v_result := public.mnty_business_employee_upsert(
    'tenant-a','10000000-0000-0000-0000-000000000001',v_elevated_position_id,
    'Finance Override Target','finance-override-target@example.test','',null,'ACTIVE',
    '{"modules":{"FINANCE":["manage"]}}',null,null
  );
  v_elevated_employee_id := (v_result->>'id')::uuid;
  IF v_elevated_position_id IS NULL OR v_elevated_employee_id IS NULL THEN
    RAISE EXCEPTION 'STALE_OVERRIDE_FIXTURE_SETUP_FAILED';
  END IF;

  -- The delegated employee can update EMPLOYEES roles but cannot grant FINANCE.MANAGE.
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated","is_anonymous":false}',true);
  PERFORM public.mnty_business_employee_position_upsert(
    'tenant-a','10000000-0000-0000-0000-000000000001','Restricted employee role','','','FULL_TIME',
    '{"modules":{"EMPLOYEES":["update"]}}',false,true,null,v_elevated_position_id
  );
  IF EXISTS (
    SELECT 1 FROM public.business_employees e
    WHERE e.id=v_elevated_employee_id
      AND e.permission_overrides <> '{}'::jsonb
  ) THEN
    RAISE EXCEPTION 'STALE_EMPLOYEE_OVERRIDE_NOT_REVOKED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_memberships m
    WHERE m.id='MNTY-EMPLOYEE-'||replace(v_elevated_employee_id::text,'-','')
      AND coalesce(m.permissions #> ARRAY['modules','FINANCE'],'[]'::jsonb) ? 'manage'
  ) THEN
    RAISE EXCEPTION 'STALE_FINANCE_PERMISSION_SURVIVED_POSITION_REDUCTION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.action='BUSINESS_JOB_POSITION_UPDATED'
      AND al.entity_id=v_elevated_position_id::text
      AND jsonb_array_length(al.new_values->'revoked_employee_overrides')=1
  ) THEN
    RAISE EXCEPTION 'STALE_OVERRIDE_REVOCATION_NOT_AUDITED';
  END IF;

  -- Anonymous JWTs are rejected before membership inspection.
  PERFORM set_config('request.jwt.claim.sub','',true);
  PERFORM set_config('request.jwt.claims','{"role":"anon","is_anonymous":true}',true);
  BEGIN
    PERFORM public.mnty_business_employee_list_scoped('tenant-a','10000000-0000-0000-0000-000000000001',null);
    RAISE EXCEPTION 'ANONYMOUS_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'ANONYMOUS_ROSTER_READ_UNEXPECTEDLY_SUCCEEDED' THEN RAISE; END IF;
    IF position('AUTH_REQUIRED' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
END
$dashboard_permission_tests$;

RESET ROLE;
SELECT 'PROFESSIONAL_DASHBOARD_EMPLOYEE_RBAC_INTEGRATION=PASS' AS result;
