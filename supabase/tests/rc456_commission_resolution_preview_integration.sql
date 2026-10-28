-- RC456 integration test: read-only scope and priority selection.
-- Executed only in the isolated disposable forward-migration replay DB.
BEGIN;

DO $fixture$
DECLARE
  v_actor uuid := 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b';
  v_suffix text := replace(gen_random_uuid()::text,'-','');
  v_membership_id varchar := 'RC456-PREVIEW-MEM-' || replace(gen_random_uuid()::text,'-','');
  v_business uuid;
  v_category text;
  v_product uuid := gen_random_uuid();
  v_tenant_rule varchar;
  v_business_rule varchar;
  v_category_rule varchar;
  v_product_rule varchar;
  v_future_rule varchar;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id='MNTY-PLATFORM') THEN
    RAISE EXCEPTION 'RC456_FIXTURE_TENANT_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=v_actor) THEN
    RAISE EXCEPTION 'RC456_FIXTURE_AUTH_USER_MISSING';
  END IF;
  SELECT id INTO v_business
    FROM public.businesses
   WHERE tenant_id='MNTY-PLATFORM'
   ORDER BY id
   LIMIT 1;
  IF v_business IS NULL THEN RAISE EXCEPTION 'RC456_FIXTURE_BUSINESS_MISSING'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_memberships
    WHERE user_id=v_actor AND tenant_id='MNTY-PLATFORM'
      AND business_id IS NULL AND branch_id IS NULL
      AND upper(role::text)='SUPER_ADMIN'
      AND coalesce(permissions->>'scope','')='PLATFORM'
      AND coalesce((permissions->>'full_control')::boolean,false)=true
  ) THEN
    INSERT INTO public.user_memberships
      (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
    VALUES
      (v_membership_id,v_actor,'MNTY-PLATFORM',null,null,null,'SUPER_ADMIN',
        '{"scope":"PLATFORM","full_control":true}'::jsonb,'ACTIVE');
  END IF;

  v_tenant_rule := 'RC456-TENANT-' || v_suffix;
  v_business_rule := 'RC456-BUSINESS-' || v_suffix;
  v_category_rule := 'RC456-CATEGORY-' || v_suffix;
  v_product_rule := 'RC456-PRODUCT-' || v_suffix;
  v_future_rule := 'RC456-FUTURE-' || v_suffix;
  v_category := 'RC456-CAT-' || v_suffix;

  INSERT INTO public.commission_rules
    (id,tenant_id,business_id,module_id,rule_type,percentage,fixed_amount,per_item_amount,active,
     rule_name,calculation_mode,scope_type,scope_ref,eligibility_event,rule_priority,
     minimum_commission_amount,maximum_commission_amount,effective_from,effective_to,is_exempt,approval_status,version_no,created_by,updated_by)
  VALUES
    (v_tenant_rule,'MNTY-PLATFORM',null,null,'PERCENTAGE',5,0,0,false,
      'RC456 tenant','PERCENTAGE','TENANT',null,'ORDER_PAID',100,
      null,null,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_business_rule,'MNTY-PLATFORM',v_business,null,'PERCENTAGE',8,0,0,false,
      'RC456 business','PERCENTAGE','BUSINESS',v_business::text,'ORDER_PAID',150,
      null,null,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_category_rule,'MNTY-PLATFORM',null,null,'PERCENTAGE',6,0,0,false,
      'RC456 category','PERCENTAGE','CATEGORY',v_category,'ORDER_PAID',200,
      null,null,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_product_rule,'MNTY-PLATFORM',null,null,'COMBINED',10,5,0,false,
      'RC456 product','COMBINED','PRODUCT',v_product::text,'ORDER_PAID',200,
      30,null,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_future_rule,'MNTY-PLATFORM',null,null,'PERCENTAGE',99,0,0,false,
      'RC456 future','PERCENTAGE','PRODUCT',v_product::text,'ORDER_PAID',999,
      null,null,now()+interval '1 day',now()+interval '2 days',false,'DRAFT',1,v_actor,v_actor);

  PERFORM set_config('rc456.actor',v_actor::text,true);
  PERFORM set_config('rc456.business',v_business::text,true);
  PERFORM set_config('rc456.category',v_category,true);
  PERFORM set_config('rc456.product',v_product::text,true);
  PERFORM set_config('rc456.tenant_rule',v_tenant_rule,true);
  PERFORM set_config('rc456.business_rule',v_business_rule,true);
  PERFORM set_config('rc456.category_rule',v_category_rule,true);
  PERFORM set_config('rc456.product_rule',v_product_rule,true);
  PERFORM set_config('rc456.future_rule',v_future_rule,true);
END
$fixture$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f7914ac7-4b03-4456-afdd-e386f2ac6a5b',true);
SELECT set_config('request.jwt.claims','{"sub":"f7914ac7-4b03-4456-afdd-e386f2ac6a5b","role":"authenticated","is_anonymous":false}',true);

DO $test$
DECLARE
  v_result jsonb;
  v_business uuid := current_setting('rc456.business')::uuid;
  v_category text := current_setting('rc456.category');
  v_product text := current_setting('rc456.product');
  v_error text;
BEGIN
  v_result := public.preview_commission_rule_resolution(
    'MNTY-PLATFORM',v_business,null,'PRODUCT',v_product,v_category,'ORDER_PAID',200
  );
  IF coalesce((v_result->>'preview_only')::boolean,false) IS NOT TRUE
     OR coalesce((v_result->>'applies_to_orders')::boolean,true) IS NOT FALSE
     OR coalesce((v_result->>'rule_count')::integer,0) <> 4
     OR v_result->>'selected_rule_id' IS DISTINCT FROM current_setting('rc456.product_rule')
     OR (v_result->'selected_preview'->>'commission_amount')::numeric <> 30 THEN
    RAISE EXCEPTION 'RC456_SPECIFICITY_RESOLUTION_MISMATCH: %',v_result;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_result->'candidates') AS candidate(item) WHERE item->>'rule_id'=current_setting('rc456.future_rule')) THEN
    RAISE EXCEPTION 'RC456_FUTURE_RULE_WAS_INCLUDED';
  END IF;

  UPDATE public.commission_rules
     SET rule_priority=201
   WHERE id=current_setting('rc456.category_rule')
     AND tenant_id='MNTY-PLATFORM'
     AND active=false AND approval_status='DRAFT';

  v_result := public.preview_commission_rule_resolution(
    'MNTY-PLATFORM',v_business,null,'PRODUCT',v_product,v_category,'ORDER_PAID',200
  );
  IF v_result->>'selected_rule_id' IS DISTINCT FROM current_setting('rc456.category_rule')
     OR (v_result->'selected_preview'->>'commission_amount')::numeric <> 12 THEN
    RAISE EXCEPTION 'RC456_PRIORITY_RESOLUTION_MISMATCH: %',v_result;
  END IF;

  v_result := public.preview_commission_rule_resolution(
    'MNTY-PLATFORM',v_business,null,'PRODUCT',v_product,v_category,'ORDER_COMPLETED',200
  );
  IF coalesce((v_result->>'rule_count')::integer,-1) <> 0
     OR v_result->>'selected_rule_id' IS NOT NULL THEN
    RAISE EXCEPTION 'RC456_EVENT_FILTER_MISMATCH: %',v_result;
  END IF;

  IF exists (
    select 1 from jsonb_array_elements(v_result->'candidates') item
    where item->>'rule_id'=current_setting('rc456.future_rule')
  ) THEN
    RAISE EXCEPTION 'RC456_FUTURE_RULE_WAS_SELECTED';
  END IF;

  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
  BEGIN
    PERFORM public.preview_commission_rule_resolution(
      'MNTY-PLATFORM',v_business,null,'PRODUCT',v_product,v_category,'ORDER_PAID',200
    );
    RAISE EXCEPTION 'RC456_UNAUTHORIZED_RESOLUTION_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error = 'RC456_UNAUTHORIZED_RESOLUTION_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error <> 'COMMISSION_RULE_FORBIDDEN' THEN
      RAISE EXCEPTION 'RC456_EXPECTED_SCOPE_DENIAL_BUT_GOT: %',v_error;
    END IF;
  END;

  RAISE NOTICE 'PASS: resolution ranking, category scopes, business scopes, event filtering, effective dates, selected preview, and authorization.';
END
$test$;

ROLLBACK;
