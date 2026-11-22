-- RC499 cash confirmation behavioral tests. Run after fixture and RC499 migration.
DO $tests$
DECLARE
  actor_multi uuid := '20000000-0000-0000-0000-000000000001';
  actor_wrong_branch uuid := '20000000-0000-0000-0000-000000000002';
  actor_business_wide uuid := '20000000-0000-0000-0000-000000000003';
  actor_tenant_owner uuid := '20000000-0000-0000-0000-000000000004';
  actor_object_permission uuid := '20000000-0000-0000-0000-000000000005';
  actor_array_permission uuid := '20000000-0000-0000-0000-000000000006';
  actor_false_permission uuid := '20000000-0000-0000-0000-000000000007';
  actor_customer_permission uuid := '20000000-0000-0000-0000-000000000008';
  actor_tenant_manager uuid := '20000000-0000-0000-0000-000000000009';
  business_a uuid := '10000000-0000-0000-0000-000000000001';
  business_b uuid := '10000000-0000-0000-0000-000000000002';
  order_multi uuid := '40000000-0000-0000-0000-000000000001';
  order_wrong uuid := '40000000-0000-0000-0000-000000000002';
  order_business_wide uuid := '40000000-0000-0000-0000-000000000003';
  order_tenant_owner uuid := '40000000-0000-0000-0000-000000000004';
  order_object_permission uuid := '40000000-0000-0000-0000-000000000005';
  order_array_permission uuid := '40000000-0000-0000-0000-000000000006';
  order_false_permission uuid := '40000000-0000-0000-0000-000000000007';
  order_customer_permission uuid := '40000000-0000-0000-0000-000000000008';
  order_tenant_manager uuid := '40000000-0000-0000-0000-000000000009';
  intent_multi text := '50000000-0000-0000-0000-000000000001';
  intent_wrong text := '50000000-0000-0000-0000-000000000002';
  intent_business_wide text := '50000000-0000-0000-0000-000000000003';
  intent_tenant_owner text := '50000000-0000-0000-0000-000000000004';
  intent_object_permission text := '50000000-0000-0000-0000-000000000005';
  intent_array_permission text := '50000000-0000-0000-0000-000000000006';
  intent_false_permission text := '50000000-0000-0000-0000-000000000007';
  intent_customer_permission text := '50000000-0000-0000-0000-000000000008';
  intent_tenant_manager text := '50000000-0000-0000-0000-000000000009';
  order_obligation_conflict uuid := '40000000-0000-0000-0000-000000000010';
  order_event_conflict uuid := '40000000-0000-0000-0000-000000000011';
  intent_obligation_conflict text := '50000000-0000-0000-0000-000000000010';
  intent_event_conflict text := '50000000-0000-0000-0000-000000000011';
  v_result jsonb;
BEGIN
  INSERT INTO public.tenant_payment_methods(tenant_id,payment_method,provider,is_enabled)
  VALUES ('TENANT-A','CASH_ON_DELIVERY','CASH_ON_DELIVERY',true);

  INSERT INTO public.commission_rules(tenant_id,business_id,active,rule_type,percentage,updated_at)
  VALUES
    ('TENANT-A',business_a,true,'PERCENTAGE',10,now()),
    ('TENANT-A',business_b,true,'PERCENTAGE',10,now());

  INSERT INTO public.orders(id,tenant_id,business_id,branch_id,customer_id,status,total_amount,currency,pricing_hash,pricing_version)
  VALUES
    (order_multi,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_wrong,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_business_wide,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_tenant_owner,'TENANT-A',business_b,'BRANCH-B','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_object_permission,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_array_permission,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_false_permission,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_customer_permission,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_tenant_manager,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_obligation_conflict,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1),
    (order_event_conflict,'TENANT-A',business_a,'BRANCH-A','30000000-0000-0000-0000-000000000001','PENDING',100,'EGP','hash-1',1);

  INSERT INTO public.payment_intents(id,tenant_id,order_id,amount,currency,status,payment_method,provider,pricing_hash,pricing_version)
  VALUES
    (intent_multi,'TENANT-A',order_multi,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_wrong,'TENANT-A',order_wrong,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_business_wide,'TENANT-A',order_business_wide,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_tenant_owner,'TENANT-A',order_tenant_owner,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_object_permission,'TENANT-A',order_object_permission,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_array_permission,'TENANT-A',order_array_permission,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_false_permission,'TENANT-A',order_false_permission,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_customer_permission,'TENANT-A',order_customer_permission,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_tenant_manager,'TENANT-A',order_tenant_manager,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_obligation_conflict,'TENANT-A',order_obligation_conflict,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1),
    (intent_event_conflict,'TENANT-A',order_event_conflict,100,'EGP','PENDING','CASH_ON_DELIVERY','CASH_ON_DELIVERY','hash-1',1);

  -- Deliberately pre-seed conflicting idempotency keys. Confirmation must fail closed.
  INSERT INTO public.financial_obligations(
    id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,
    obligation_type,gross_amount,amount,currency,status,payment_method,metadata
  ) VALUES (
    'cash_commission:'||intent_obligation_conflict,'TENANT-A',business_a,order_obligation_conflict,
    intent_obligation_conflict,'PLATFORM','PLATFORM','PLATFORM_COMMISSION',100,99,'EGP','DUE','CASH',
    jsonb_build_object('reason','CUSTOMER_PAID_PROVIDER_DIRECTLY','commission_rule_id','wrong-rule',
      'commission_rate',10,'confirmed_by',actor_multi)
  );

  INSERT INTO public.payment_events(
    id,tenant_id,event_id,payment_id,amount,payment_method,status,raw_payload,created_at
  ) VALUES (
    gen_random_uuid(),'TENANT-A','cash_confirmed:'||intent_event_conflict,intent_event_conflict,
    99,'CASH_ON_DELIVERY','PROCESSED',
    jsonb_build_object('action','CASH_CONFIRMED','confirmed_by',actor_multi,
      'previous_status','PENDING','new_status','SUCCEEDED','commission_amount',10,
      'commission_rule_id','wrong-rule'),
    now()
  );

  -- An unrelated membership is inserted before the authorized membership.
  -- The RPC must select the branch-A manager row, not an arbitrary tenant row.
  INSERT INTO public.user_memberships(user_id,tenant_id,business_id,branch_id,role,status,permissions)
  VALUES
    (actor_multi,'TENANT-A',business_b,'BRANCH-B','CUSTOMER','ACTIVE','{}'::jsonb),
    (actor_multi,'TENANT-A',business_a,'BRANCH-A','MANAGER','ACTIVE','{}'::jsonb),
    (actor_wrong_branch,'TENANT-A',business_a,'BRANCH-B','MANAGER','ACTIVE','{}'::jsonb),
    (actor_business_wide,'TENANT-A',business_a,NULL,'MANAGER','ACTIVE','{}'::jsonb),
    (actor_tenant_owner,'TENANT-A',NULL,NULL,'OWNER','ACTIVE','{}'::jsonb),
    (actor_object_permission,'TENANT-A',business_a,'BRANCH-A','OPERATIONS','ACTIVE','{"PAYMENT_CONFIRM_CASH":true}'::jsonb),
    (actor_array_permission,'TENANT-A',business_a,'BRANCH-A','OPERATIONS','ACTIVE','["PAYMENT_CONFIRM_CASH"]'::jsonb),
    (actor_false_permission,'TENANT-A',business_a,'BRANCH-A','OPERATIONS','ACTIVE','{"PAYMENT_CONFIRM_CASH":false}'::jsonb),
    (actor_customer_permission,'TENANT-A',business_a,'BRANCH-A','CUSTOMER','ACTIVE','{"PAYMENT_CONFIRM_CASH":true}'::jsonb),
    (actor_tenant_manager,'TENANT-A',NULL,NULL,'MANAGER','ACTIVE','{}'::jsonb);

  IF NOT has_function_privilege('service_role','public.confirm_cash_payment(character varying,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.confirm_cash_payment(character varying,uuid)','EXECUTE')
     OR has_function_privilege('authenticated','public.confirm_cash_payment(character varying,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'TEST_FAILED: RC499 cash confirmation ACL is not service-role-only';
  END IF;

  PERFORM set_config('request.jwt.claim.sub',actor_multi::text,true);
  v_result := public.confirm_cash_payment(intent_multi,actor_multi);
  IF v_result->>'status' <> 'success' THEN RAISE EXCEPTION 'TEST_FAILED: matching membership was shadowed by another tenant membership'; END IF;

  -- A repeated authorized confirmation remains idempotent.
  v_result := public.confirm_cash_payment(intent_multi,actor_multi);
  IF v_result->>'message' <> 'Already confirmed' THEN RAISE EXCEPTION 'TEST_FAILED: cash confirmation retry was not idempotent'; END IF;

  -- The same succeeded intent is still protected from a different actor.
  PERFORM set_config('request.jwt.claim.sub',actor_wrong_branch::text,true);
  BEGIN
    PERFORM public.confirm_cash_payment(intent_multi,actor_wrong_branch);
    RAISE EXCEPTION 'TEST_FAILED: unauthorized actor received an already-confirmed payment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: unauthorized actor received an already-confirmed payment' THEN RAISE; END IF;
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE EXCEPTION 'TEST_FAILED: expected FORBIDDEN for succeeded intent, got %',SQLERRM; END IF;
  END;

  -- A role scoped to another branch in the same business cannot confirm.
  PERFORM set_config('request.jwt.claim.sub',actor_wrong_branch::text,true);
  BEGIN
    PERFORM public.confirm_cash_payment(intent_wrong,actor_wrong_branch);
    RAISE EXCEPTION 'TEST_FAILED: cross-branch manager confirmed cash payment';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: cross-branch manager confirmed cash payment' THEN RAISE; END IF;
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE EXCEPTION 'TEST_FAILED: expected FORBIDDEN for wrong branch, got %',SQLERRM; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',actor_business_wide::text,true);
  v_result := public.confirm_cash_payment(intent_business_wide,actor_business_wide);
  IF v_result->>'status' <> 'success' THEN RAISE EXCEPTION 'TEST_FAILED: business-wide manager was denied an order in its business'; END IF;

  PERFORM set_config('request.jwt.claim.sub',actor_tenant_owner::text,true);
  v_result := public.confirm_cash_payment(intent_tenant_owner,actor_tenant_owner);
  IF v_result->>'status' <> 'success' THEN RAISE EXCEPTION 'TEST_FAILED: tenant-wide OWNER was denied'; END IF;

  PERFORM set_config('request.jwt.claim.sub',actor_object_permission::text,true);
  v_result := public.confirm_cash_payment(intent_object_permission,actor_object_permission);
  IF v_result->>'status' <> 'success' THEN RAISE EXCEPTION 'TEST_FAILED: true boolean-object permission was denied'; END IF;

  PERFORM set_config('request.jwt.claim.sub',actor_array_permission::text,true);
  v_result := public.confirm_cash_payment(intent_array_permission,actor_array_permission);
  IF v_result->>'status' <> 'success' THEN RAISE EXCEPTION 'TEST_FAILED: array permission was denied'; END IF;

  PERFORM set_config('request.jwt.claim.sub',actor_false_permission::text,true);
  BEGIN
    PERFORM public.confirm_cash_payment(intent_false_permission,actor_false_permission);
    RAISE EXCEPTION 'TEST_FAILED: false boolean permission authorized cash confirmation';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: false boolean permission authorized cash confirmation' THEN RAISE; END IF;
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE EXCEPTION 'TEST_FAILED: expected FORBIDDEN for false permission, got %',SQLERRM; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',actor_customer_permission::text,true);
  BEGIN
    PERFORM public.confirm_cash_payment(intent_customer_permission,actor_customer_permission);
    RAISE EXCEPTION 'TEST_FAILED: CUSTOMER role with permission confirmed cash';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: CUSTOMER role with permission confirmed cash' THEN RAISE; END IF;
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE EXCEPTION 'TEST_FAILED: expected FORBIDDEN for CUSTOMER role, got %',SQLERRM; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',actor_tenant_manager::text,true);
  BEGIN
    PERFORM public.confirm_cash_payment(intent_tenant_manager,actor_tenant_manager);
    RAISE EXCEPTION 'TEST_FAILED: tenant-wide MANAGER received OWNER/ADMIN-only scope';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: tenant-wide MANAGER received OWNER/ADMIN-only scope' THEN RAISE; END IF;
    IF SQLERRM <> 'FORBIDDEN' THEN RAISE EXCEPTION 'TEST_FAILED: expected FORBIDDEN for unscoped MANAGER, got %',SQLERRM; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub',actor_multi::text,true);
  BEGIN
    PERFORM public.confirm_cash_payment(intent_obligation_conflict,actor_multi);
    RAISE EXCEPTION 'TEST_FAILED: conflicting cash commission obligation was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: conflicting cash commission obligation was accepted' THEN RAISE; END IF;
    IF SQLERRM <> 'CASH_COMMISSION_OBLIGATION_CONFLICT' THEN
      RAISE EXCEPTION 'TEST_FAILED: expected commission obligation conflict, got %',SQLERRM;
    END IF;
  END;
  IF (SELECT status FROM public.payment_intents WHERE id=intent_obligation_conflict) <> 'PENDING' THEN
    RAISE EXCEPTION 'TEST_FAILED: obligation conflict partially confirmed payment';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE event_id='cash_confirmed:'||intent_obligation_conflict) THEN
    RAISE EXCEPTION 'TEST_FAILED: obligation conflict emitted a payment event';
  END IF;

  BEGIN
    PERFORM public.confirm_cash_payment(intent_event_conflict,actor_multi);
    RAISE EXCEPTION 'TEST_FAILED: conflicting cash payment event was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'TEST_FAILED: conflicting cash payment event was accepted' THEN RAISE; END IF;
    IF SQLERRM <> 'CASH_PAYMENT_EVENT_CONFLICT' THEN
      RAISE EXCEPTION 'TEST_FAILED: expected payment event conflict, got %',SQLERRM;
    END IF;
  END;
  IF (SELECT status FROM public.payment_intents WHERE id=intent_event_conflict) <> 'PENDING' THEN
    RAISE EXCEPTION 'TEST_FAILED: event conflict partially confirmed payment';
  END IF;
  IF EXISTS (SELECT 1 FROM public.financial_obligations WHERE id='cash_commission:'||intent_event_conflict) THEN
    RAISE EXCEPTION 'TEST_FAILED: event conflict created a commission obligation';
  END IF;

  IF (SELECT count(*) FROM public.payment_events WHERE event_id='cash_confirmed:'||intent_multi) <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: duplicate cash confirmation event';
  END IF;
  IF (SELECT count(*) FROM public.financial_obligations WHERE id='cash_commission:'||intent_multi) <> 1 THEN
    RAISE EXCEPTION 'TEST_FAILED: duplicate cash commission obligation';
  END IF;
END;
$tests$;

SELECT 'RC499 cash confirmation business/branch scope and membership selection: PASS' AS result;
