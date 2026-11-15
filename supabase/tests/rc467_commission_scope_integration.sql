-- RC467 behavioral security tests. Disposable forward-replay database only.
-- All fixture rows are rolled back. Never execute against Production.
BEGIN;

DO $fixture$
DECLARE
  v_tenant text := 'MNTY-PLATFORM';
  v_business uuid;
  v_other_business uuid := pg_catalog.gen_random_uuid();
  v_branch text;
  v_suffix text := replace(pg_catalog.gen_random_uuid()::text,'-','');
  v_platform uuid := '46700000-0000-4000-8000-000000000001';
  v_business_owner uuid := '46700000-0000-4000-8000-000000000002';
  v_branch_owner uuid := '46700000-0000-4000-8000-000000000003';
  v_tenant_owner uuid := '46700000-0000-4000-8000-000000000004';
  v_business_finance uuid := '46700000-0000-4000-8000-000000000005';
  v_branch_finance uuid := '46700000-0000-4000-8000-000000000006';
  v_tenant_finance uuid := '46700000-0000-4000-8000-000000000007';
  v_other_owner uuid := '46700000-0000-4000-8000-000000000008';
BEGIN
  SELECT b.id INTO v_business
  FROM public.businesses b
  WHERE b.tenant_id = v_tenant
  ORDER BY b.id
  LIMIT 1;
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'RC467_FIXTURE_BUSINESS_MISSING';
  END IF;

  INSERT INTO auth.users
    (id,aud,role,email,encrypted_password,email_confirmed_at,
     raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
  VALUES
    (v_platform,'authenticated','authenticated','rc467-platform@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_business_owner,'authenticated','authenticated','rc467-business-owner@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_branch_owner,'authenticated','authenticated','rc467-branch-owner@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_tenant_owner,'authenticated','authenticated','rc467-tenant-owner@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_business_finance,'authenticated','authenticated','rc467-business-finance@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_branch_finance,'authenticated','authenticated','rc467-branch-finance@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_tenant_finance,'authenticated','authenticated','rc467-tenant-finance@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false),
    (v_other_owner,'authenticated','authenticated','rc467-other-owner@example.invalid','',now(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{"rc467_fixture":true}'::jsonb,now(),now(),false,false)
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE business_id=v_business) THEN
    v_branch := 'RC467-BRANCH-' || v_suffix;
    INSERT INTO public.branches(id,tenant_id,business_id,name,code,status,created_at,updated_at)
    VALUES(v_branch,v_tenant,v_business,'RC467 disposable branch','RC467-'||v_suffix,'ACTIVE',now(),now());
  ELSE
    SELECT id INTO v_branch FROM public.branches WHERE business_id=v_business ORDER BY id LIMIT 1;
  END IF;

  INSERT INTO public.businesses(id,tenant_id,name,code,status)
  VALUES(v_other_business,v_tenant,'RC467 disposable second business','RC467-'||v_suffix,'INACTIVE');

  INSERT INTO public.user_memberships
    (id,user_id,tenant_id,business_id,branch_id,role,status)
  VALUES
    ('RC467-BIZ-OWNER-'||v_suffix,v_business_owner,v_tenant,v_business,NULL,'BUSINESS_OWNER','ACTIVE'),
    ('RC467-BRANCH-OWNER-'||v_suffix,v_branch_owner,v_tenant,v_business,v_branch,'BUSINESS_OWNER','ACTIVE'),
    ('RC467-TENANT-OWNER-'||v_suffix,v_tenant_owner,v_tenant,NULL,NULL,'OWNER','ACTIVE'),
    ('RC467-BIZ-FINANCE-'||v_suffix,v_business_finance,v_tenant,v_business,NULL,'FINANCE','ACTIVE'),
    ('RC467-BRANCH-FINANCE-'||v_suffix,v_branch_finance,v_tenant,v_business,v_branch,'FINANCE','ACTIVE'),
    ('RC467-TENANT-FINANCE-'||v_suffix,v_tenant_finance,v_tenant,NULL,NULL,'FINANCE','ACTIVE'),
    ('RC467-OTHER-OWNER-'||v_suffix,v_other_owner,v_tenant,v_other_business,NULL,'OWNER','ACTIVE');

  INSERT INTO private.platform_admins(user_id)
  VALUES(v_platform);

  INSERT INTO public.commission_rules
    (id,tenant_id,business_id,module_id,rule_type,percentage,fixed_amount,per_item_amount,active)
  VALUES
    ('RC467-ACTIVE-'||v_suffix,v_tenant,v_business,NULL,'PERCENTAGE',5,0,0,true);

  PERFORM pg_catalog.set_config('rc467.tenant',v_tenant,true);
  PERFORM pg_catalog.set_config('rc467.business',v_business::text,true);
  PERFORM pg_catalog.set_config('rc467.other_business',v_other_business::text,true);
  PERFORM pg_catalog.set_config('rc467.platform_actor',v_platform::text,true);
  PERFORM pg_catalog.set_config('rc467.business_owner',v_business_owner::text,true);
  PERFORM pg_catalog.set_config('rc467.branch_owner',v_branch_owner::text,true);
  PERFORM pg_catalog.set_config('rc467.tenant_owner',v_tenant_owner::text,true);
  PERFORM pg_catalog.set_config('rc467.business_finance',v_business_finance::text,true);
  PERFORM pg_catalog.set_config('rc467.branch_finance',v_branch_finance::text,true);
  PERFORM pg_catalog.set_config('rc467.tenant_finance',v_tenant_finance::text,true);
END;
$fixture$;

DO $acl_test$
BEGIN
  IF pg_catalog.has_function_privilege('anon',
    'public.mnty_commission_rule_drafts(text,character varying,character varying,jsonb)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
    'public.preview_commission_rule_draft(character varying,character varying,numeric)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
    'public.preview_commission_rule_resolution(character varying,uuid,character varying,text,text,text,text,numeric)','EXECUTE')
    OR pg_catalog.has_function_privilege('anon',
    'public.preview_commission_backend(character varying,uuid,character varying,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'RC467_ANON_EXECUTE_GRANT_FOUND';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated',
    'public.mnty_commission_rule_drafts(text,character varying,character varying,jsonb)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated',
    'public.preview_commission_rule_draft(character varying,character varying,numeric)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated',
    'public.preview_commission_rule_resolution(character varying,uuid,character varying,text,text,text,text,numeric)','EXECUTE')
    OR NOT pg_catalog.has_function_privilege('authenticated',
    'public.preview_commission_backend(character varying,uuid,character varying,numeric)','EXECUTE') THEN
    RAISE EXCEPTION 'RC467_AUTHENTICATED_EXECUTE_MISSING';
  END IF;
END;
$acl_test$;

SET LOCAL ROLE authenticated;

DO $behavior$
DECLARE
  v_tenant text := current_setting('rc467.tenant');
  v_business uuid := current_setting('rc467.business')::uuid;
  v_other_business uuid := current_setting('rc467.other_business')::uuid;
  v_platform uuid := current_setting('rc467.platform_actor')::uuid;
  v_business_owner uuid := current_setting('rc467.business_owner')::uuid;
  v_branch_owner uuid := current_setting('rc467.branch_owner')::uuid;
  v_tenant_owner uuid := current_setting('rc467.tenant_owner')::uuid;
  v_business_finance uuid := current_setting('rc467.business_finance')::uuid;
  v_branch_finance uuid := current_setting('rc467.branch_finance')::uuid;
  v_tenant_finance uuid := current_setting('rc467.tenant_finance')::uuid;
  v_result jsonb;
  v_rule_id text;
  v_error text;
BEGIN
  -- Canonical registry member may administer and preview commission drafts.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_platform::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_platform::text,'role','authenticated','is_anonymous',false)::text,true);

  v_result := public.mnty_commission_rule_drafts('SAVE',v_tenant,NULL,
    pg_catalog.jsonb_build_object(
      'rule_name','RC467 platform test draft',
      'calculation_mode','PERCENTAGE',
      'scope_type','TENANT',
      'eligibility_event','ORDER_PAID',
      'percentage',5,
      'fixed_amount',0,
      'rule_priority',100
    ));
  v_rule_id := v_result->>'rule_id';
  IF v_rule_id IS NULL OR v_result->>'approval_status' <> 'DRAFT' THEN
    RAISE EXCEPTION 'RC467_PLATFORM_SAVE_FAILED: %',v_result;
  END IF;

  v_result := public.mnty_commission_rule_drafts('LIST',v_tenant,NULL,'{}'::jsonb);
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_array_elements(v_result->'rules') item
    WHERE item->>'id'=v_rule_id
  ) THEN RAISE EXCEPTION 'RC467_PLATFORM_LIST_FAILED'; END IF;

  v_result := public.mnty_commission_rule_drafts('AUDIT',v_tenant,NULL,'{}'::jsonb);
  IF pg_catalog.jsonb_array_length(coalesce(v_result->'entries','[]'::jsonb)) < 1 THEN
    RAISE EXCEPTION 'RC467_PLATFORM_AUDIT_FAILED';
  END IF;

  v_result := public.preview_commission_rule_draft(v_tenant,v_rule_id,200);
  IF coalesce((v_result->>'preview_only')::boolean,false) IS NOT TRUE
     OR (v_result->>'commission_amount')::numeric <> 10 THEN
    RAISE EXCEPTION 'RC467_PLATFORM_DRAFT_PREVIEW_FAILED: %',v_result;
  END IF;

  v_result := public.preview_commission_rule_resolution(
    v_tenant,v_business,NULL,'TENANT',NULL,NULL,'ORDER_PAID',200
  );
  IF v_result->>'selected_rule_id' IS DISTINCT FROM v_rule_id THEN
    RAISE EXCEPTION 'RC467_PLATFORM_RESOLUTION_PREVIEW_FAILED: %',v_result;
  END IF;

  -- Business-scoped owner cannot list/save/audit or preview platform commission drafts.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_business_owner::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_business_owner::text,'role','authenticated','is_anonymous',false)::text,true);
  BEGIN
    PERFORM public.mnty_commission_rule_drafts('SAVE',v_tenant,NULL,'{"rule_name":"unauthorized"}'::jsonb);
    RAISE EXCEPTION 'RC467_BUSINESS_OWNER_SAVE_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_BUSINESS_OWNER_SAVE_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'PLATFORM_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'RC467_BUSINESS_OWNER_WRONG_DENIAL: %',v_error; END IF;
  END;
  BEGIN
    PERFORM public.mnty_commission_rule_drafts('LIST',v_tenant,NULL,'{}'::jsonb);
    RAISE EXCEPTION 'RC467_BUSINESS_OWNER_LIST_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_BUSINESS_OWNER_LIST_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'PLATFORM_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'RC467_BUSINESS_OWNER_LIST_WRONG_DENIAL: %',v_error; END IF;
  END;
  BEGIN
    PERFORM public.preview_commission_rule_draft(v_tenant,v_rule_id,200);
    RAISE EXCEPTION 'RC467_BUSINESS_OWNER_PREVIEW_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_BUSINESS_OWNER_PREVIEW_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'PLATFORM_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'RC467_BUSINESS_OWNER_PREVIEW_WRONG_DENIAL: %',v_error; END IF;
  END;
  BEGIN
    PERFORM public.preview_commission_rule_resolution(v_tenant,v_business,NULL,'TENANT',NULL,NULL,'ORDER_PAID',200);
    RAISE EXCEPTION 'RC467_BUSINESS_OWNER_RESOLUTION_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_BUSINESS_OWNER_RESOLUTION_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'PLATFORM_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'RC467_BUSINESS_OWNER_RESOLUTION_WRONG_DENIAL: %',v_error; END IF;
  END;

  -- Branch-scoped owner and fully unscoped tenant owner receive the same explicit denial.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_branch_owner::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_branch_owner::text,'role','authenticated','is_anonymous',false)::text,true);
  BEGIN
    PERFORM public.mnty_commission_rule_drafts('LIST',v_tenant,NULL,'{}'::jsonb);
    RAISE EXCEPTION 'RC467_BRANCH_OWNER_LIST_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_BRANCH_OWNER_LIST_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'PLATFORM_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'RC467_BRANCH_OWNER_WRONG_DENIAL: %',v_error; END IF;
  END;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_tenant_owner::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_tenant_owner::text,'role','authenticated','is_anonymous',false)::text,true);
  BEGIN
    PERFORM public.mnty_commission_rule_drafts('AUDIT',v_tenant,NULL,'{}'::jsonb);
    RAISE EXCEPTION 'RC467_TENANT_OWNER_AUDIT_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_TENANT_OWNER_AUDIT_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'PLATFORM_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'RC467_TENANT_OWNER_WRONG_DENIAL: %',v_error; END IF;
  END;

  -- Active commission preview is permitted to exact-business or tenant-wide finance only.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_business_finance::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_business_finance::text,'role','authenticated','is_anonymous',false)::text,true);
  v_result := public.preview_commission_backend(v_tenant,v_business,NULL,200);
  IF (v_result->>'commission_amount')::numeric <> 10
     OR (v_result->>'provider_net_amount')::numeric <> 190 THEN
    RAISE EXCEPTION 'RC467_EXACT_BUSINESS_FINANCE_PREVIEW_FAILED: %',v_result;
  END IF;
  BEGIN
    PERFORM public.preview_commission_backend(v_tenant,v_other_business,NULL,200);
    RAISE EXCEPTION 'RC467_CROSS_BUSINESS_FINANCE_PREVIEW_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_CROSS_BUSINESS_FINANCE_PREVIEW_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'FINANCE_SCOPE_REQUIRED' THEN RAISE EXCEPTION 'RC467_CROSS_BUSINESS_WRONG_DENIAL: %',v_error; END IF;
  END;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_branch_finance::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_branch_finance::text,'role','authenticated','is_anonymous',false)::text,true);
  BEGIN
    PERFORM public.preview_commission_backend(v_tenant,v_business,NULL,200);
    RAISE EXCEPTION 'RC467_BRANCH_FINANCE_PREVIEW_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_BRANCH_FINANCE_PREVIEW_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'FINANCE_SCOPE_REQUIRED' THEN RAISE EXCEPTION 'RC467_BRANCH_FINANCE_WRONG_DENIAL: %',v_error; END IF;
  END;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_tenant_finance::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_tenant_finance::text,'role','authenticated','is_anonymous',false)::text,true);
  v_result := public.preview_commission_backend(v_tenant,v_business,NULL,200);
  IF (v_result->>'commission_amount')::numeric <> 10 THEN
    RAISE EXCEPTION 'RC467_TENANT_FINANCE_PREVIEW_FAILED: %',v_result;
  END IF;

  -- A valid UID with an anonymous JWT claim is not a finance actor.
  PERFORM pg_catalog.set_config('request.jwt.claims',
    pg_catalog.jsonb_build_object('sub',v_tenant_finance::text,'role','authenticated','is_anonymous',true)::text,true);
  BEGIN
    PERFORM public.preview_commission_backend(v_tenant,v_business,NULL,200);
    RAISE EXCEPTION 'RC467_ANONYMOUS_FINANCE_PREVIEW_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error=MESSAGE_TEXT;
    IF v_error='RC467_ANONYMOUS_FINANCE_PREVIEW_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error<>'UNAUTHENTICATED' THEN RAISE EXCEPTION 'RC467_ANONYMOUS_WRONG_DENIAL: %',v_error; END IF;
  END;
END;
$behavior$;

ROLLBACK;

SELECT 'RC467 commission admin and finance scope integration: PASS' AS result;
