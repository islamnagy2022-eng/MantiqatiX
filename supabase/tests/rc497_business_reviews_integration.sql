-- RC497 disposable integration assertions. Run only after fixture + migration.
\set ON_ERROR_STOP on

-- Customer may review only their own delivered order; exact retries are idempotent.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',false);

DO $customer_review$
DECLARE result jsonb;
BEGIN
  result := public.submit_business_review(
    '30000000-0000-4000-8000-000000000001', 5, 'تجربة شراء موثقة'
  );
  IF result->>'status' <> 'PENDING' OR result->>'idempotent' <> 'false' THEN
    RAISE EXCEPTION 'RC497_SUBMISSION_RESULT_INVALID: %', result;
  END IF;
  PERFORM set_config('test.review_id', result->>'reviewId', false);

  result := public.get_customer_business_review_status(
    '30000000-0000-4000-8000-000000000001'
  );
  IF result->>'hasReview' <> 'true'
     OR result->>'status' <> 'PENDING'
     OR result->>'reviewId' IS NULL THEN
    RAISE EXCEPTION 'RC497_CUSTOMER_REVIEW_STATUS_LOOKUP_FAILED: %', result;
  END IF;

  result := public.get_customer_business_review_status(
    '30000000-0000-4000-8000-000000000003'
  );
  IF result->>'hasReview' <> 'false' OR result ? 'reviewId' THEN
    RAISE EXCEPTION 'RC497_CUSTOMER_READS_FOREIGN_REVIEW_STATUS: %', result;
  END IF;

  result := public.submit_business_review(
    '30000000-0000-4000-8000-000000000001', 5, 'تجربة شراء موثقة'
  );
  IF result->>'idempotent' <> 'true' THEN
    RAISE EXCEPTION 'RC497_EXACT_RETRY_NOT_IDEMPOTENT: %', result;
  END IF;

  BEGIN
    PERFORM public.submit_business_review(
      '30000000-0000-4000-8000-000000000001', 1, 'محاولة تغيير التقييم'
    );
    RAISE EXCEPTION 'RC497_CHANGED_REVIEW_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'REVIEW_ALREADY_SUBMITTED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.submit_business_review(
      '30000000-0000-4000-8000-000000000002', 4, 'طلب لم يكتمل'
    );
    RAISE EXCEPTION 'RC497_UNDELIVERED_ORDER_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ORDER_NOT_DELIVERED' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.submit_business_review(
      '30000000-0000-4000-8000-000000000003', 4, 'طلب عميل آخر'
    );
    RAISE EXCEPTION 'RC497_FOREIGN_ORDER_WAS_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'BUSINESS_REVIEW_FORBIDDEN' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.submit_business_review(
      '30000000-0000-4000-8000-000000000005', 4, 'طلب لنشاط في مستأجر آخر'
    );
    RAISE EXCEPTION 'RC497_ORDER_BUSINESS_TENANT_MISMATCH_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ORDER_BUSINESS_TENANT_MISMATCH' THEN RAISE; END IF;
  END;

  result := public.submit_business_review(
    '30000000-0000-4000-8000-000000000004', 4, 'نشاط غير موثق بعد'
  );
  IF result->>'status' <> 'PENDING' THEN
    RAISE EXCEPTION 'RC497_UNVERIFIED_BUSINESS_REVIEW_NOT_PENDING';
  END IF;

  BEGIN
    PERFORM public.moderate_business_review(
      (result->>'reviewId')::uuid, 'PUBLISHED', NULL
    );
    RAISE EXCEPTION 'RC497_TENANT_CUSTOMER_MODERATED_REVIEW';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PLATFORM_ADMIN_REQUIRED' THEN RAISE; END IF;
  END;
END
$customer_review$;

RESET ROLE;

-- Business owner cannot answer pending reviews.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',false);

DO $owner_before_publish$
DECLARE review_id uuid;
BEGIN
  review_id := current_setting('test.review_id')::uuid;
  BEGIN
    PERFORM public.respond_to_business_review(review_id, 'شكرًا لثقتك');
    RAISE EXCEPTION 'RC497_OWNER_RESPONDED_TO_PENDING_REVIEW';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'REVIEW_NOT_PUBLIC' THEN RAISE; END IF;
  END;
END
$owner_before_publish$;

RESET ROLE;

-- Only a platform-registry member may moderate.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',false);

DO $moderation$
DECLARE v_review_id uuid; result jsonb;
BEGIN
  v_review_id := current_setting('test.review_id')::uuid;
  BEGIN
    PERFORM public.moderate_business_review(v_review_id, 'REJECTED', NULL);
    RAISE EXCEPTION 'RC497_REJECTION_WITHOUT_REASON_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'MODERATION_REASON_REQUIRED' THEN RAISE; END IF;
  END;

  result := public.moderate_business_review(v_review_id, 'PUBLISHED', 'اجتاز مراجعة المحتوى');
  IF result->>'status' <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'RC497_MODERATION_FAILED';
  END IF;
END
$moderation$;

RESET ROLE;

DO $moderation_audit$
DECLARE event_previous text;
BEGIN
  SELECT previous_status INTO event_previous
    FROM public.business_review_events
   WHERE review_id=current_setting('test.review_id')::uuid AND event_type='MODERATED'
   ORDER BY created_at DESC LIMIT 1;
  IF event_previous <> 'PENDING' THEN
    RAISE EXCEPTION 'RC497_MODERATION_AUDIT_PREVIOUS_STATE_INVALID: %', event_previous;
  END IF;
END
$moderation_audit$;

-- Correct business owner may answer exactly once; a different business owner may not.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',false);

DO $business_response$
DECLARE review_id uuid; result jsonb;
BEGIN
  review_id := current_setting('test.review_id')::uuid;
  result := public.respond_to_business_review(review_id, 'شكرًا لملاحظاتك');
  IF result->>'reviewId' IS NULL THEN RAISE EXCEPTION 'RC497_OWNER_RESPONSE_FAILED'; END IF;

  BEGIN
    PERFORM public.respond_to_business_review(review_id, 'محاولة رد مكرر');
    RAISE EXCEPTION 'RC497_DUPLICATE_BUSINESS_RESPONSE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'BUSINESS_REVIEW_ALREADY_ANSWERED' THEN RAISE; END IF;
  END;
END
$business_response$;

RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}',false);

DO $wrong_business$
DECLARE review_id uuid;
BEGIN
  review_id := current_setting('test.review_id')::uuid;
  BEGIN
    PERFORM public.respond_to_business_review(review_id, 'رد من نشاط آخر');
    RAISE EXCEPTION 'RC497_WRONG_BUSINESS_RESPONDED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'BUSINESS_REVIEW_RESPONSE_FORBIDDEN' THEN RAISE; END IF;
  END;
END
$wrong_business$;

RESET ROLE;

-- Anonymous public summary contains only approved, identity-free fields.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT set_config('request.jwt.claims','{"role":"anon"}',false);

DO $public_summary$
DECLARE result jsonb; review jsonb; hidden jsonb;
BEGIN
  result := public.get_public_business_review_summary(
    '20000000-0000-4000-8000-000000000001', 10, 0
  );
  IF (result->>'reviewCount')::integer <> 1
     OR (result->>'averageRating')::numeric <> 5 THEN
    RAISE EXCEPTION 'RC497_PUBLIC_AGGREGATE_INVALID: %', result;
  END IF;
  review := result->'reviews'->0;
  IF review->>'verifiedInteraction' <> 'true'
     OR review ? 'customerId' OR review ? 'customer_id'
     OR review ? 'tenantId' OR review ? 'tenant_id' THEN
    RAISE EXCEPTION 'RC497_PUBLIC_REVIEW_DISCLOSES_PRIVATE_IDENTITY: %', review;
  END IF;
  IF review->>'businessResponse' <> 'شكرًا لملاحظاتك' THEN
    RAISE EXCEPTION 'RC497_PUBLIC_BUSINESS_RESPONSE_MISSING: %', review;
  END IF;

  hidden := public.get_public_business_review_summary(
    '20000000-0000-4000-8000-000000000002', 100, -5
  );
  IF (hidden->>'reviewCount')::integer <> 0
     OR jsonb_array_length(hidden->'reviews') <> 0 THEN
    RAISE EXCEPTION 'RC497_UNVERIFIED_BUSINESS_REVIEWS_EXPOSED: %', hidden;
  END IF;
END
$public_summary$;

RESET ROLE;

-- No direct table access; only the intended narrow RPC grants are available.
DO $acl$
BEGIN
  IF has_table_privilege('anon','public.business_reviews','SELECT')
     OR has_table_privilege('authenticated','public.business_reviews','SELECT')
     OR has_table_privilege('service_role','public.business_reviews','SELECT')
     OR has_table_privilege('anon','public.business_reviews','INSERT')
     OR has_table_privilege('authenticated','public.business_reviews','INSERT')
     OR has_table_privilege('service_role','public.business_reviews','INSERT')
     OR has_table_privilege('anon','public.business_reviews','UPDATE')
     OR has_table_privilege('authenticated','public.business_reviews','UPDATE')
     OR has_table_privilege('service_role','public.business_reviews','UPDATE')
     OR has_table_privilege('anon','public.business_reviews','DELETE')
     OR has_table_privilege('authenticated','public.business_reviews','DELETE')
     OR has_table_privilege('service_role','public.business_reviews','DELETE')
     OR has_table_privilege('anon','public.business_review_events','SELECT')
     OR has_table_privilege('authenticated','public.business_review_events','SELECT')
     OR has_table_privilege('service_role','public.business_review_events','SELECT')
     OR has_table_privilege('anon','public.business_review_events','INSERT')
     OR has_table_privilege('authenticated','public.business_review_events','INSERT')
     OR has_table_privilege('service_role','public.business_review_events','INSERT')
     OR has_table_privilege('anon','public.business_review_events','UPDATE')
     OR has_table_privilege('authenticated','public.business_review_events','UPDATE')
     OR has_table_privilege('service_role','public.business_review_events','UPDATE')
     OR has_table_privilege('anon','public.business_review_events','DELETE')
     OR has_table_privilege('authenticated','public.business_review_events','DELETE')
     OR has_table_privilege('service_role','public.business_review_events','DELETE') THEN
    RAISE EXCEPTION 'RC497_DIRECT_TABLE_READ_GRANT_FOUND';
  END IF;
  IF NOT has_function_privilege('anon','public.get_public_business_review_summary(uuid,integer,integer)','EXECUTE')
     OR has_function_privilege('anon','public.submit_business_review(uuid,integer,text)','EXECUTE')
     OR has_function_privilege('anon','public.moderate_business_review(uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.respond_to_business_review(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC497_RPC_ACL_CONTRACT_INVALID';
  END IF;
  IF NOT (
    SELECT c.relrowsecurity AND c.relforcerowsecurity
      FROM pg_class c WHERE c.oid='public.business_reviews'::regclass
  ) OR NOT (
    SELECT c.relrowsecurity AND c.relforcerowsecurity
      FROM pg_class c WHERE c.oid='public.business_review_events'::regclass
  ) THEN
    RAISE EXCEPTION 'RC497_FORCE_RLS_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM public.business_review_events
       WHERE review_id=(SELECT id FROM public.business_reviews WHERE order_id='30000000-0000-4000-8000-000000000001')) <> 3 THEN
    RAISE EXCEPTION 'RC497_REVIEW_EVENT_AUDIT_INCOMPLETE';
  END IF;
END
$acl$;

DO $account_deletion$
DECLARE retained integer; actor_refs integer;
BEGIN
  DELETE FROM auth.users WHERE id='10000000-0000-4000-8000-000000000001';
  SELECT count(*)::integer INTO retained
    FROM public.business_reviews
   WHERE order_id IN (
     '30000000-0000-4000-8000-000000000001',
     '30000000-0000-4000-8000-000000000004'
   );
  IF retained <> 2 THEN
    RAISE EXCEPTION 'RC497_ACCOUNT_DELETION_REMOVED_REVIEWS';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.business_reviews
     WHERE order_id='30000000-0000-4000-8000-000000000001'
       AND customer_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'RC497_ACCOUNT_DELETION_DID_NOT_ANONYMIZE_REVIEW';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.business_reviews
     WHERE order_id='30000000-0000-4000-8000-000000000001'
       AND review_text IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'RC497_ACCOUNT_DELETION_DID_NOT_SCRUB_REVIEW_TEXT';
  END IF;
  SELECT count(*)::integer INTO actor_refs
    FROM public.business_review_events
   WHERE actor_user_id='10000000-0000-4000-8000-000000000001';
  IF actor_refs <> 0 THEN
    RAISE EXCEPTION 'RC497_ACCOUNT_DELETION_RETAINED_ACTOR_REFERENCE';
  END IF;
END
$account_deletion$;

SELECT 'RC497_BUSINESS_REVIEWS_INTEGRATION=PASS';
