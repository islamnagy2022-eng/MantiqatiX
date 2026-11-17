INSERT INTO auth.users(id) VALUES
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005');

INSERT INTO public.businesses(id,tenant_id,organization_id,status,settings) VALUES
  ('20000000-0000-4000-8000-000000000001','TENANT-1','ORG-1','ACTIVE',
   '{"bizcatalog":{"paymentStatus":"paid","paymentConfirmedByAdmin":true}}'),
  ('20000000-0000-4000-8000-000000000002','TENANT-1','ORG-1','ACTIVE',
   '{"bizcatalog":{"paymentStatus":"paid","paymentConfirmedByAdmin":true}}'),
  ('20000000-0000-4000-8000-000000000003','TENANT-1','ORG-1','ACTIVE',
   '{"bizcatalog":{"paymentStatus":"unpaid","paymentConfirmedByAdmin":false}}'),
  ('20000000-0000-4000-8000-000000000004','TENANT-1','ORG-1','ACTIVE',
   '{"bizcatalog":{"paymentStatus":"paid","paymentConfirmedByAdmin":true}}');

INSERT INTO public.public_directory_listings(id,claim_status,claimed_user_id) VALUES
  ('30000000-0000-4000-8000-000000000001','CLAIM_PENDING','10000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002','CLAIM_PENDING','10000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003','CLAIM_PENDING','10000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000004','CLAIM_PENDING','10000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000005','CLAIM_PENDING','10000000-0000-4000-8000-000000000005');

INSERT INTO public.directory_listing_claim_requests(id,listing_id,user_id,status) VALUES
  ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','PENDING'),
  ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','PENDING'),
  ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','PENDING'),
  ('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000004','PENDING'),
  ('40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000005','PENDING');

-- Existing automatic platform owner is allowed to be detached after verified claim approval.
INSERT INTO public.user_memberships(id,user_id,tenant_id,organization_id,business_id,role,status,permissions)
VALUES ('AUTO-OWNER-1','10000000-0000-4000-8000-000000000005','TENANT-1','ORG-1',
        '20000000-0000-4000-8000-000000000001','BUSINESS_OWNER','ACTIVE',
        '{"auto_assigned_default_owner":true}');

-- A real foreign owner blocks a claim.
INSERT INTO public.user_memberships(id,user_id,tenant_id,organization_id,business_id,role,status,permissions)
VALUES ('FOREIGN-OWNER-1','10000000-0000-4000-8000-000000000003','TENANT-1','ORG-1',
        '20000000-0000-4000-8000-000000000002','BUSINESS_OWNER','ACTIVE','{"owner":true}');

DO $test$
DECLARE
  v_result jsonb;
  v_status text;
  v_membership text;
  v_failed boolean;
  v_count integer;
BEGIN
  -- Successful approval is atomic and detaches only the automatic owner.
  v_result := public.review_directory_listing_claim_atomic(
    '40000000-0000-4000-8000-000000000001','APPROVED',
    '10000000-0000-4000-8000-000000000003','verified',
    '20000000-0000-4000-8000-000000000001',true,true
  );
  IF v_result->>'status' <> 'APPROVED' THEN RAISE EXCEPTION 'approval result mismatch: %',v_result; END IF;
  v_membership := v_result->>'membershipId';
  IF NOT EXISTS (SELECT 1 FROM public.user_memberships WHERE id=v_membership AND status='ACTIVE' AND role='BUSINESS_OWNER') THEN
    RAISE EXCEPTION 'claimant owner membership was not activated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_memberships WHERE id='AUTO-OWNER-1' AND status='INACTIVE') THEN
    RAISE EXCEPTION 'automatic owner was not detached';
  END IF;
  SELECT status INTO v_status FROM public.directory_listing_claim_requests WHERE id='40000000-0000-4000-8000-000000000001';
  IF v_status <> 'APPROVED' OR NOT EXISTS (SELECT 1 FROM public.public_directory_listings WHERE id='30000000-0000-4000-8000-000000000001' AND claim_status='CLAIMED') THEN
    RAISE EXCEPTION 'claim and listing were not finalized together';
  END IF;

  -- Rejection releases the listing lock and finalizes the request.
  v_result := public.review_directory_listing_claim_atomic(
    '40000000-0000-4000-8000-000000000002','REJECTED',
    '10000000-0000-4000-8000-000000000003','not verified',NULL,false,false
  );
  IF v_result->>'status' <> 'REJECTED'
     OR NOT EXISTS (SELECT 1 FROM public.public_directory_listings WHERE id='30000000-0000-4000-8000-000000000002' AND claim_status='UNCLAIMED' AND claimed_user_id IS NULL) THEN
    RAISE EXCEPTION 'rejection did not release the listing';
  END IF;

  -- Injected rejection failure must roll back the claim status as well.
  PERFORM set_config('test.fail_directory_listing_write','on',true);
  v_failed := false;
  BEGIN
    PERFORM public.review_directory_listing_claim_atomic(
      '40000000-0000-4000-8000-000000000003','REJECTED',
      '10000000-0000-4000-8000-000000000003','forced failure',NULL,false,false
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'forced_directory_listing_write_failure' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  PERFORM set_config('test.fail_directory_listing_write','off',true);
  IF NOT v_failed THEN RAISE EXCEPTION 'expected injected rejection failure'; END IF;
  SELECT status INTO v_status FROM public.directory_listing_claim_requests WHERE id='40000000-0000-4000-8000-000000000003';
  IF v_status <> 'PENDING' OR NOT EXISTS (SELECT 1 FROM public.public_directory_listings WHERE id='30000000-0000-4000-8000-000000000003' AND claim_status='CLAIM_PENDING') THEN
    RAISE EXCEPTION 'rejection failure did not roll back all writes';
  END IF;

  -- Injected finalization failure must roll back membership and listing writes.
  PERFORM set_config('test.fail_claim_approval_write','on',true);
  v_failed := false;
  BEGIN
    PERFORM public.review_directory_listing_claim_atomic(
      '40000000-0000-4000-8000-000000000003','APPROVED',
      '10000000-0000-4000-8000-000000000003','forced failure',
      '20000000-0000-4000-8000-000000000004',true,true
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'forced_claim_approval_write_failure' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  PERFORM set_config('test.fail_claim_approval_write','off',true);
  IF NOT v_failed THEN RAISE EXCEPTION 'expected injected approval failure'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_memberships WHERE user_id='10000000-0000-4000-8000-000000000003' AND business_id='20000000-0000-4000-8000-000000000004') THEN
    RAISE EXCEPTION 'approval failure left a claimant membership behind';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.public_directory_listings WHERE id='30000000-0000-4000-8000-000000000003' AND claim_status='CLAIM_PENDING') THEN
    RAISE EXCEPTION 'approval failure left the listing claimed';
  END IF;

  -- A foreign real owner blocks approval.
  v_failed := false;
  BEGIN
    PERFORM public.review_directory_listing_claim_atomic(
      '40000000-0000-4000-8000-000000000004','APPROVED',
      '10000000-0000-4000-8000-000000000003','owner conflict',
      '20000000-0000-4000-8000-000000000002',true,true
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'BUSINESS_ALREADY_HAS_OWNER' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'foreign owner conflict was not rejected'; END IF;

  -- Unpaid subscriptions fail closed.
  v_failed := false;
  BEGIN
    PERFORM public.review_directory_listing_claim_atomic(
      '40000000-0000-4000-8000-000000000005','APPROVED',
      '10000000-0000-4000-8000-000000000003','unpaid',
      '20000000-0000-4000-8000-000000000003',true,true
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'PAID_SUBSCRIPTION_REQUIRED' THEN v_failed := true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'unpaid subscription was not rejected'; END IF;

  -- The null-safe unique index must prevent duplicate business-wide memberships.
  INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status,permissions)
  VALUES ('UNIQUE-1','10000000-0000-4000-8000-000000000003','TENANT-1','20000000-0000-4000-8000-000000000003',NULL,'BUSINESS_OWNER','ACTIVE','{}');
  v_failed := false;
  BEGIN
    INSERT INTO public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status,permissions)
    VALUES ('UNIQUE-2','10000000-0000-4000-8000-000000000003','TENANT-1','20000000-0000-4000-8000-000000000003',NULL,'BUSINESS_OWNER','ACTIVE','{}');
  EXCEPTION WHEN unique_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'null branch duplicate membership was not blocked'; END IF;

  IF NOT has_function_privilege('service_role',
    'public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute the claim RPC';
  END IF;
  IF has_function_privilege('anon',
    'public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)','EXECUTE')
     OR has_function_privilege('authenticated',
    'public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean)','EXECUTE') THEN
    RAISE EXCEPTION 'browser roles must not execute the claim RPC';
  END IF;
END;
$test$;


-- Two independent pending claims target the same business. The concurrency
-- runner races them in separate PostgreSQL sessions after this setup.
INSERT INTO public.businesses(id,tenant_id,organization_id,status,settings)
VALUES ('20000000-0000-4000-8000-000000000005','TENANT-1','ORG-1','ACTIVE',
        '{"bizcatalog":{"paymentStatus":"paid","paymentConfirmedByAdmin":true}}');
INSERT INTO public.public_directory_listings(id,claim_status,claimed_user_id) VALUES
  ('30000000-0000-4000-8000-000000000006','CLAIM_PENDING','10000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000007','CLAIM_PENDING','10000000-0000-4000-8000-000000000005');
INSERT INTO public.directory_listing_claim_requests(id,listing_id,user_id,status) VALUES
  ('40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000004','PENDING'),
  ('40000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000005','PENDING');
