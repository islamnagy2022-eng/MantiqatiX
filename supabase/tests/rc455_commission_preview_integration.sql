-- RC455 integration test: preview math + access control.
-- Only executed in the disposable forward-migration replay database.
BEGIN;

DO $fixture$
DECLARE
  v_actor uuid := 'f7914ac7-4b03-4456-afdd-e386f2ac6a5b';
  v_suffix text := replace(gen_random_uuid()::text,'-','');
  v_membership_id varchar := 'RC455-PREVIEW-MEM-' || replace(gen_random_uuid()::text,'-','');
  v_pct varchar;
  v_fixed varchar;
  v_combined varchar;
  v_exempt varchar;
  v_capped varchar;
  v_future varchar;
  v_over_gross varchar;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id='MNTY-PLATFORM') THEN
    RAISE EXCEPTION 'RC455_FIXTURE_TENANT_MISSING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=v_actor) THEN
    RAISE EXCEPTION 'RC455_FIXTURE_AUTH_USER_MISSING';
  END IF;

  INSERT INTO public.user_memberships
    (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
  VALUES
    (v_membership_id,v_actor,'MNTY-PLATFORM',null,null,null,'SUPER_ADMIN',
      '{"scope":"PLATFORM","full_control":true}'::jsonb,'ACTIVE');

  v_pct := 'RC455-PREVIEW-PCT-' || v_suffix;
  v_fixed := 'RC455-PREVIEW-FIXED-' || v_suffix;
  v_combined := 'RC455-PREVIEW-COMBINED-' || v_suffix;
  v_exempt := 'RC455-PREVIEW-EXEMPT-' || v_suffix;
  v_capped := 'RC455-PREVIEW-CAPPED-' || v_suffix;
  v_future := 'RC455-PREVIEW-FUTURE-' || v_suffix;
  v_over_gross := 'RC455-PREVIEW-OVERGROSS-' || v_suffix;

  INSERT INTO public.commission_rules
    (id,tenant_id,business_id,module_id,rule_type,percentage,fixed_amount,per_item_amount,active,
     rule_name,calculation_mode,scope_type,eligibility_event,minimum_commission_amount,maximum_commission_amount,
     effective_from,effective_to,is_exempt,approval_status,version_no,created_by,updated_by)
  VALUES
    (v_pct,'MNTY-PLATFORM',null,null,'PERCENTAGE',12.5,0,0,false,'RC455 percent preview','PERCENTAGE','TENANT','ORDER_PAID',null,null,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_fixed,'MNTY-PLATFORM',null,null,'FIXED',0,18,0,false,'RC455 fixed preview','FIXED','TENANT','ORDER_PAID',null,null,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_combined,'MNTY-PLATFORM',null,null,'COMBINED',10,5,0,false,'RC455 combined preview','COMBINED','TENANT','ORDER_PAID',30,40,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_exempt,'MNTY-PLATFORM',null,null,'PERCENTAGE',20,0,0,false,'RC455 exemption preview','PERCENTAGE','TENANT','ORDER_PAID',30,40,null,null,true,'DRAFT',1,v_actor,v_actor),
    (v_capped,'MNTY-PLATFORM',null,null,'PERCENTAGE',80,0,0,false,'RC455 capped preview','PERCENTAGE','TENANT','ORDER_PAID',null,50,null,null,false,'DRAFT',1,v_actor,v_actor),
    (v_future,'MNTY-PLATFORM',null,null,'PERCENTAGE',10,0,0,false,'RC455 future preview','PERCENTAGE','TENANT','ORDER_PAID',null,null,now()+interval '1 day',now()+interval '2 days',false,'DRAFT',1,v_actor,v_actor),
    (v_over_gross,'MNTY-PLATFORM',null,null,'FIXED',0,101,0,false,'RC455 over-gross preview','FIXED','TENANT','ORDER_PAID',null,null,null,null,false,'DRAFT',1,v_actor,v_actor);

  PERFORM set_config('rc455.preview.actor',v_actor::text,true);
  PERFORM set_config('rc455.preview.rule_pct',v_pct,true);
  PERFORM set_config('rc455.preview.rule_fixed',v_fixed,true);
  PERFORM set_config('rc455.preview.rule_combined',v_combined,true);
  PERFORM set_config('rc455.preview.rule_exempt',v_exempt,true);
  PERFORM set_config('rc455.preview.rule_capped',v_capped,true);
  PERFORM set_config('rc455.preview.rule_future',v_future,true);
  PERFORM set_config('rc455.preview.rule_over_gross',v_over_gross,true);
END
$fixture$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','f7914ac7-4b03-4456-afdd-e386f2ac6a5b',true);
SELECT set_config('request.jwt.claims','{"sub":"f7914ac7-4b03-4456-afdd-e386f2ac6a5b","role":"authenticated","is_anonymous":false}',true);

DO $test$
DECLARE
  v_result jsonb;
  v_rule text;
  v_actor uuid := current_setting('rc455.preview.actor')::uuid;
  v_error text;
BEGIN
  v_rule := current_setting('rc455.preview.rule_pct');
  v_result := public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,200);
  IF (v_result->>'commission_amount')::numeric <> 25
     OR (v_result->>'provider_net_amount')::numeric <> 175
     OR (v_result->>'raw_commission_amount')::numeric <> 25
     OR v_result->>'preview_only' <> 'true'
     OR v_result->>'applies_to_orders' <> 'false' THEN
    RAISE EXCEPTION 'RC455_PERCENT_PREVIEW_MISMATCH: %',v_result;
  END IF;

  v_rule := current_setting('rc455.preview.rule_fixed');
  v_result := public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,200);
  IF (v_result->>'commission_amount')::numeric <> 18
     OR (v_result->>'provider_net_amount')::numeric <> 182 THEN
    RAISE EXCEPTION 'RC455_FIXED_PREVIEW_MISMATCH: %',v_result;
  END IF;

  v_rule := current_setting('rc455.preview.rule_combined');
  v_result := public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,200);
  IF (v_result->>'raw_commission_amount')::numeric <> 25
     OR (v_result->>'commission_amount')::numeric <> 30
     OR (v_result->>'provider_net_amount')::numeric <> 170 THEN
    RAISE EXCEPTION 'RC455_COMBINED_MINIMUM_PREVIEW_MISMATCH: %',v_result;
  END IF;

  v_rule := current_setting('rc455.preview.rule_exempt');
  v_result := public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,200);
  IF (v_result->>'commission_amount')::numeric <> 0
     OR (v_result->>'provider_net_amount')::numeric <> 200 THEN
    RAISE EXCEPTION 'RC455_EXEMPT_PREVIEW_MISMATCH: %',v_result;
  END IF;

  v_rule := current_setting('rc455.preview.rule_capped');
  v_result := public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,100);
  IF (v_result->>'raw_commission_amount')::numeric <> 80
     OR (v_result->>'commission_amount')::numeric <> 50
     OR (v_result->>'provider_net_amount')::numeric <> 50 THEN
    RAISE EXCEPTION 'RC455_MAXIMUM_PREVIEW_MISMATCH: %',v_result;
  END IF;

  v_rule := current_setting('rc455.preview.rule_future');
  v_result := public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,100);
  IF (v_result->>'currently_in_effect')::boolean IS DISTINCT FROM false
     OR (v_result->>'commission_amount')::numeric <> 10 THEN
    RAISE EXCEPTION 'RC455_FUTURE_WINDOW_PREVIEW_MISMATCH: %',v_result;
  END IF;

  v_rule := current_setting('rc455.preview.rule_over_gross');
  BEGIN
    PERFORM public.preview_commission_rule_draft('MNTY-PLATFORM',v_rule,100);
    RAISE EXCEPTION 'RC455_OVER_GROSS_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error = 'RC455_OVER_GROSS_WAS_ACCEPTED' THEN RAISE; END IF;
    IF v_error <> 'PREVIEW_COMMISSION_EXCEEDS_GROSS' THEN
      RAISE EXCEPTION 'RC455_EXPECTED_OVER_GROSS_DENIAL_BUT_GOT: %',v_error;
    END IF;
  END;

  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  BEGIN
    PERFORM public.preview_commission_rule_draft('MNTY-PLATFORM',current_setting('rc455.preview.rule_pct'),200);
    RAISE EXCEPTION 'RC455_UNAUTHORIZED_PREVIEW_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error = 'RC455_UNAUTHORIZED_PREVIEW_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error <> 'COMMISSION_RULE_FORBIDDEN' THEN
      RAISE EXCEPTION 'RC455_EXPECTED_SCOPE_DENIAL_BUT_GOT: %',v_error;
    END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_actor::text,'role','authenticated','is_anonymous',true)::text,true);
  BEGIN
    PERFORM public.preview_commission_rule_draft('MNTY-PLATFORM',current_setting('rc455.preview.rule_pct'),200);
    RAISE EXCEPTION 'RC455_ANONYMOUS_PREVIEW_WAS_ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error = 'RC455_ANONYMOUS_PREVIEW_WAS_ALLOWED' THEN RAISE; END IF;
    IF v_error <> 'AUTH_REQUIRED' THEN
      RAISE EXCEPTION 'RC455_EXPECTED_ANONYMOUS_DENIAL_BUT_GOT: %',v_error;
    END IF;
  END;

  RAISE NOTICE 'PASS: commission preview formulas, min/max, exemption, effective period, gross bound, tenant/platform authorization and anonymous rejection.';
END
$test$;

ROLLBACK;
