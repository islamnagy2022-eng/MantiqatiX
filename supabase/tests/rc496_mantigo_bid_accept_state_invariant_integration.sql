-- RC496 adversarial state-machine checks; run only on disposable PostgreSQL.
BEGIN;

INSERT INTO public.mantigo_rides(id,customer_id,status,accepted_bid_id)
VALUES
 ('RC496-VALID','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-ACCEPTED','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-REJECTED','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-WITHDRAWN','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-EXPIRED','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-OWNER','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-REPLAY-DIFFERENT','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-FARE-FAIL','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-STALE-WINNER','49600000-0000-4000-8000-000000000001','OPEN',NULL),
 ('RC496-LEDGER-MISMATCH','49600000-0000-4000-8000-000000000001','ACCEPTED','RC496-LEDGER-MISMATCH-BID'),
 ('RC496-DUPLICATE-WINNER','49600000-0000-4000-8000-000000000001','ACCEPTED','RC496-DUPLICATE-WINNER-A');

INSERT INTO public.mantigo_bids(id,ride_id,captain_id,offered_price,status)
VALUES
 ('RC496-WINNER','RC496-VALID','49600000-0000-4000-8000-000000000011',120,'OFFERED'),
 ('RC496-SIBLING','RC496-VALID','49600000-0000-4000-8000-000000000012',125,'OFFERED'),
 ('RC496-WITHDRAWN-SIBLING','RC496-VALID','49600000-0000-4000-8000-000000000013',130,'WITHDRAWN'),
 ('RC496-SELECT-ACCEPTED','RC496-ACCEPTED','49600000-0000-4000-8000-000000000014',100,'ACCEPTED'),
 ('RC496-SELECT-REJECTED','RC496-REJECTED','49600000-0000-4000-8000-000000000015',100,'REJECTED'),
 ('RC496-SELECT-WITHDRAWN','RC496-WITHDRAWN','49600000-0000-4000-8000-000000000016',100,'WITHDRAWN'),
 ('RC496-SELECT-EXPIRED','RC496-EXPIRED','49600000-0000-4000-8000-000000000017',100,'EXPIRED'),
 ('RC496-OWNER-BID','RC496-OWNER','49600000-0000-4000-8000-000000000018',100,'OFFERED'),
 ('RC496-DIFFERENT-BID','RC496-REPLAY-DIFFERENT','49600000-0000-4000-8000-000000000019',100,'OFFERED'),
 ('RC496-FARE-FAIL-WINNER','RC496-FARE-FAIL','49600000-0000-4000-8000-000000000020',100,'OFFERED'),
 ('RC496-FARE-FAIL-SIBLING','RC496-FARE-FAIL','49600000-0000-4000-8000-000000000023',110,'OFFERED'),
 ('RC496-STALE-ACCEPTED','RC496-STALE-WINNER','49600000-0000-4000-8000-000000000024',90,'ACCEPTED'),
 ('RC496-STALE-OFFERED','RC496-STALE-WINNER','49600000-0000-4000-8000-000000000025',100,'OFFERED'),
 ('RC496-LEDGER-MISMATCH-BID','RC496-LEDGER-MISMATCH','49600000-0000-4000-8000-000000000026',120,'ACCEPTED'),
 ('RC496-DUPLICATE-WINNER-A','RC496-DUPLICATE-WINNER','49600000-0000-4000-8000-000000000027',100,'ACCEPTED'),
 ('RC496-DUPLICATE-WINNER-B','RC496-DUPLICATE-WINNER','49600000-0000-4000-8000-000000000028',110,'ACCEPTED');

INSERT INTO public.mantigo_financial_ledger(
  id,ride_id,customer_id,captain_id,currency,gross_amount,commission_amount,
  captain_net_amount,payment_status,settlement_status,idempotency_key,metadata
) VALUES (
  'MGO-FIN-RC496-MISMATCH','RC496-LEDGER-MISMATCH',
  '49600000-0000-4000-8000-000000000001',
  '49600000-0000-4000-8000-000000000099',
  'EGP',120,0,120,'REQUIRED','NOT_READY',
  'MGO-FARE-RC496-LEDGER-MISMATCH',
  '{"fare_locked":true,"accepted_bid_id":"RC496-LEDGER-MISMATCH-BID","source":"MANTIGO_ACCEPT"}'::jsonb
);

DO $test$
DECLARE
  v_customer uuid := '49600000-0000-4000-8000-000000000001';
  v_other uuid := '49600000-0000-4000-8000-000000000002';
  v_result jsonb;
  v_status text;
  v_error text;
  v_expected text;
  v_pair text[];
  v_calls bigint;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_customer::text,true);

  -- Actor mismatch cannot be used to accept a bid on another user's behalf.
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_other,'RC496-VALID','RC496-WINNER');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'USER_CONTEXT_MISMATCH' THEN
    RAISE EXCEPTION 'RC496 actor spoof expected USER_CONTEXT_MISMATCH, got %',v_error;
  END IF;

  -- A non-owner cannot accept another customer's offer.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_other::text,true);
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_other,'RC496-OWNER','RC496-OWNER-BID');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'CUSTOMER_REQUIRED' THEN
    RAISE EXCEPTION 'RC496 non-owner expected CUSTOMER_REQUIRED, got %',v_error;
  END IF;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_customer::text,true);

  -- Every terminal/non-offered bid state is rejected without touching ride,
  -- bid, financial lock, audit or notification records.
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['RC496-ACCEPTED','RC496-SELECT-ACCEPTED'],
    ARRAY['RC496-REJECTED','RC496-SELECT-REJECTED'],
    ARRAY['RC496-WITHDRAWN','RC496-SELECT-WITHDRAWN'],
    ARRAY['RC496-EXPIRED','RC496-SELECT-EXPIRED']
  ] LOOP
    v_error:=NULL;
    BEGIN
      PERFORM public.accept_mantigo_bid_backend(v_customer,v_pair[1],v_pair[2]);
    EXCEPTION WHEN OTHERS THEN
      v_error:=SQLERRM;
    END;
    IF v_error IS DISTINCT FROM 'BID_NOT_OFFERED' THEN
      RAISE EXCEPTION 'RC496 state % expected BID_NOT_OFFERED, got %',v_pair[1],v_error;
    END IF;
    SELECT status INTO v_status FROM public.mantigo_bids WHERE id=v_pair[2];
    IF v_status NOT IN ('ACCEPTED','REJECTED','WITHDRAWN','EXPIRED') THEN
      RAISE EXCEPTION 'RC496 rejected terminal bid state was mutated: % -> %',v_pair[2],v_status;
    END IF;
    IF (SELECT status FROM public.mantigo_rides WHERE id=v_pair[1])<>'OPEN'
       OR (SELECT accepted_bid_id FROM public.mantigo_rides WHERE id=v_pair[1]) IS NOT NULL THEN
      RAISE EXCEPTION 'RC496 rejected bid altered ride state %',v_pair[1];
    END IF;
  END LOOP;

  -- A stale ACCEPTED bid must block a new winner when the ride row is still OPEN
  -- and has no accepted_bid_id (legacy inconsistent state recovery).
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_customer,'RC496-STALE-WINNER','RC496-STALE-OFFERED');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'RIDE_ACCEPTANCE_STATE_MISMATCH' THEN
    RAISE EXCEPTION 'RC496 stale accepted winner expected mismatch, got %',v_error;
  END IF;
  IF (SELECT status FROM public.mantigo_rides WHERE id='RC496-STALE-WINNER')<>'OPEN'
     OR (SELECT accepted_bid_id FROM public.mantigo_rides WHERE id='RC496-STALE-WINNER') IS NOT NULL
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-STALE-ACCEPTED')<>'ACCEPTED'
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-STALE-OFFERED')<>'OFFERED'
     OR EXISTS (SELECT 1 FROM public.mantigo_financial_ledger WHERE ride_id='RC496-STALE-WINNER') THEN
    RAISE EXCEPTION 'RC496 stale accepted winner state was mutated';
  END IF;

  -- A fare-lock failure must roll back the complete acceptance transition,
  -- including the accepted bid and sibling rejections.
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_customer,'RC496-FARE-FAIL','RC496-FARE-FAIL-WINNER');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'RC496_TEST_FARE_LOCK_FAILURE' THEN
    RAISE EXCEPTION 'RC496 fare-lock failure expected rollback trigger, got %',v_error;
  END IF;
  IF (SELECT status FROM public.mantigo_rides WHERE id='RC496-FARE-FAIL')<>'OPEN'
     OR (SELECT accepted_bid_id FROM public.mantigo_rides WHERE id='RC496-FARE-FAIL') IS NOT NULL
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-FARE-FAIL-WINNER')<>'OFFERED'
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-FARE-FAIL-SIBLING')<>'OFFERED'
     OR EXISTS (SELECT 1 FROM public.mantigo_financial_ledger WHERE ride_id='RC496-FARE-FAIL')
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE action='MANTIGO_BID_ACCEPTED' AND entity_id='RC496-FARE-FAIL')
     OR EXISTS (SELECT 1 FROM public.notifications WHERE type='MANTIGO_ACCEPTED' AND entity_id='RC496-FARE-FAIL') THEN
    RAISE EXCEPTION 'RC496 fare-lock failure left a partial acceptance';
  END IF;

  -- Positive OFFERED acceptance: exactly one winner; only sibling OFFERED bids
  -- are rejected, and the fare lock is invoked after the winner is persisted.
  v_result:=public.accept_mantigo_bid_backend(v_customer,'RC496-VALID','RC496-WINNER');
  IF v_result->>'status'<>'ACCEPTED' OR v_result->>'idempotent'<>'false'
     OR v_result->'financial'->>'idempotent'<>'false'
     OR v_result->'financial'->>'payment_status'<>'REQUIRED' THEN
    RAISE EXCEPTION 'RC496 valid OFFERED acceptance failed: %',v_result;
  END IF;
  IF (SELECT status FROM public.mantigo_rides WHERE id='RC496-VALID')<>'ACCEPTED'
     OR (SELECT accepted_bid_id FROM public.mantigo_rides WHERE id='RC496-VALID')<>'RC496-WINNER'
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-WINNER')<>'ACCEPTED'
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-SIBLING')<>'REJECTED'
     OR (SELECT status FROM public.mantigo_bids WHERE id='RC496-WITHDRAWN-SIBLING')<>'WITHDRAWN' THEN
    RAISE EXCEPTION 'RC496 valid acceptance broke single-winner/sibling-state invariant';
  END IF;
  IF (SELECT count(*) FROM public.mantigo_financial_ledger WHERE ride_id='RC496-VALID')<>1
     OR (SELECT count(*) FROM public.audit_logs WHERE action='MANTIGO_BID_ACCEPTED' AND entity_id='RC496-VALID')<>1
     OR (SELECT count(*) FROM public.notifications WHERE type='MANTIGO_ACCEPTED' AND entity_id='RC496-VALID')<>1 THEN
    RAISE EXCEPTION 'RC496 valid acceptance must create one fare lock, audit and notification';
  END IF;

  -- Exact winning bid may be retried idempotently; another bid cannot replace it.
  v_result:=public.accept_mantigo_bid_backend(v_customer,'RC496-VALID','RC496-WINNER');
  IF v_result->>'idempotent'<>'true' OR
     (SELECT count(*) FROM public.audit_logs WHERE action='MANTIGO_BID_ACCEPTED' AND entity_id='RC496-VALID')<>1 OR
     (SELECT count(*) FROM public.notifications WHERE type='MANTIGO_ACCEPTED' AND entity_id='RC496-VALID')<>1 OR
     (SELECT count(*) FROM public.mantigo_financial_ledger WHERE ride_id='RC496-VALID')<>1 OR
     v_result->'financial'->>'idempotent'<>'true' THEN
    RAISE EXCEPTION 'RC496 same-winner retry was not idempotent: %',v_result;
  END IF;

  -- An accepted ride with two ACCEPTED bid rows is inconsistent; neither
  -- retry nor fare lock may create a financial row for that corrupt winner state.
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(
      v_customer,'RC496-DUPLICATE-WINNER','RC496-DUPLICATE-WINNER-A'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'RIDE_ACCEPTANCE_STATE_MISMATCH' THEN
    RAISE EXCEPTION 'RC496 duplicate accepted bids expected state mismatch, got %',v_error;
  END IF;
  IF EXISTS (SELECT 1 FROM public.mantigo_financial_ledger WHERE ride_id='RC496-DUPLICATE-WINNER') THEN
    RAISE EXCEPTION 'RC496 duplicate accepted bids created a financial ledger row';
  END IF;

  -- The same accepted bid cannot reuse a financial ledger row bound to a
  -- different captain, even when the ride and amount otherwise look plausible.
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(
      v_customer,'RC496-LEDGER-MISMATCH','RC496-LEDGER-MISMATCH-BID'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'MANTIGO_FINANCIAL_IDENTITY_MISMATCH' THEN
    RAISE EXCEPTION 'RC496 mismatched existing fare ledger expected identity denial, got %',v_error;
  END IF;
  IF (SELECT count(*) FROM public.mantigo_financial_ledger WHERE ride_id='RC496-LEDGER-MISMATCH')<>1
     OR (SELECT captain_id FROM public.mantigo_financial_ledger WHERE ride_id='RC496-LEDGER-MISMATCH')
        IS DISTINCT FROM '49600000-0000-4000-8000-000000000099'::uuid
     OR EXISTS (SELECT 1 FROM public.audit_logs WHERE action='MANTIGO_BID_ACCEPTED' AND entity_id='RC496-LEDGER-MISMATCH')
     OR EXISTS (SELECT 1 FROM public.notifications WHERE type='MANTIGO_ACCEPTED' AND entity_id='RC496-LEDGER-MISMATCH') THEN
    RAISE EXCEPTION 'RC496 mismatched existing financial identity was mutated';
  END IF;

  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_customer,'RC496-VALID','RC496-WITHDRAWN-SIBLING');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'RIDE_NOT_OPEN' THEN
    RAISE EXCEPTION 'RC496 different bid after acceptance expected RIDE_NOT_OPEN, got %',v_error;
  END IF;

  -- Wrong ride/bid pairing is indistinguishable from missing bid.
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_customer,'RC496-OWNER','RC496-DIFFERENT-BID');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'RIDE_OR_BID_NOT_FOUND' THEN
    RAISE EXCEPTION 'RC496 cross-ride bid expected RIDE_OR_BID_NOT_FOUND, got %',v_error;
  END IF;

  -- Missing bids fail closed.
  v_error:=NULL;
  BEGIN
    PERFORM public.accept_mantigo_bid_backend(v_customer,'RC496-OWNER','RC496-NOT-THERE');
  EXCEPTION WHEN OTHERS THEN
    v_error:=SQLERRM;
  END;
  IF v_error IS DISTINCT FROM 'RIDE_OR_BID_NOT_FOUND' THEN
    RAISE EXCEPTION 'RC496 missing bid expected RIDE_OR_BID_NOT_FOUND, got %',v_error;
  END IF;

  -- The fare-lock helper remains authenticated-only and empty-search-path.
  IF pg_catalog.has_function_privilege('anon','public.lock_mantigo_fare_backend(uuid,text)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.lock_mantigo_fare_backend(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC496_FARE_LOCK_EXECUTE_ACL_MISMATCH';
  END IF;
  SELECT pg_catalog.array_to_string(p.proconfig,',') INTO v_status
  FROM pg_catalog.pg_proc p
  WHERE p.oid='public.lock_mantigo_fare_backend(uuid,text)'::regprocedure
    AND p.prosecdef;
  IF v_status IS DISTINCT FROM 'search_path=""' THEN
    RAISE EXCEPTION 'RC496_FARE_LOCK_SEARCH_PATH_MISMATCH: %',v_status;
  END IF;

  -- Legacy acceptance/submission RPCs must remain revoked from browser roles.
  IF pg_catalog.has_function_privilege('anon','public.mantigo_accept_bid(text,text)','EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated','public.mantigo_accept_bid(text,text)','EXECUTE')
     OR pg_catalog.has_function_privilege('anon','public.mantigo_submit_bid(text,numeric,text,text,text,text)','EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated','public.mantigo_submit_bid(text,numeric,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC496_LEGACY_BID_RPC_CLIENT_GRANT_FOUND';
  END IF;

  -- Exact function grants and hardened SECURITY DEFINER search_path.
  IF pg_catalog.has_function_privilege('anon','public.accept_mantigo_bid_backend(uuid,text,text)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.accept_mantigo_bid_backend(uuid,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC496 acceptance EXECUTE ACL mismatch';
  END IF;
  SELECT pg_catalog.array_to_string(p.proconfig,',') INTO v_status
  FROM pg_catalog.pg_proc p
  WHERE p.oid='public.accept_mantigo_bid_backend(uuid,text,text)'::regprocedure
    AND p.prosecdef;
  IF v_status IS DISTINCT FROM 'search_path=""' THEN
    RAISE EXCEPTION 'RC496 acceptance SECURITY DEFINER search_path mismatch: %',v_status;
  END IF;
END;
$test$;

-- Prepare the concurrent race fixture. The dedicated shell test launches two
-- independent sessions against the same ride with different OFFERED bids.
INSERT INTO public.mantigo_rides(id,customer_id,status,accepted_bid_id)
VALUES ('RC496-CONCURRENT','49600000-0000-4000-8000-000000000001','OPEN',NULL);
INSERT INTO public.mantigo_bids(id,ride_id,captain_id,offered_price,status)
VALUES
 ('RC496-CONCURRENT-A','RC496-CONCURRENT','49600000-0000-4000-8000-000000000021',100,'OFFERED'),
 ('RC496-CONCURRENT-B','RC496-CONCURRENT','49600000-0000-4000-8000-000000000022',110,'OFFERED');

CREATE OR REPLACE FUNCTION public.rc496_delay_accept_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status='OFFERED' AND NEW.status='ACCEPTED' THEN
    PERFORM pg_catalog.pg_sleep(1.5);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER rc496_delay_accept_update
BEFORE UPDATE OF status ON public.mantigo_bids
FOR EACH ROW
EXECUTE FUNCTION public.rc496_delay_accept_update();

COMMIT;

SELECT 'RC496 MantiGO bid acceptance state invariant integration: PASS' AS result;
