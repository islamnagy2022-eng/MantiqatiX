-- RC477 disposable PostgreSQL privacy regression. Never run against Production.
BEGIN;

DO $test$
DECLARE
  v_customer uuid := '10000000-0000-4000-8000-000000000470';
  v_captain_one uuid := '10000000-0000-4000-8000-000000000471';
  v_captain_two uuid := '10000000-0000-4000-8000-000000000472';
  v_result jsonb;
  v_bids jsonb;
  v_offered jsonb;
  v_accepted jsonb;
  v_rejected boolean := false;
BEGIN
  INSERT INTO public.mantigo_rides(id,customer_id,customer_name,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status,created_at)
  VALUES('RC477-PRIVACY-RIDE',v_customer,'Privacy Customer','SEDAN','CITY','Pickup','Destination',100,'','ACCEPTED',pg_catalog.now());

  INSERT INTO public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,captain_rating,vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,captain_message,created_at,status)
  VALUES
    ('RC477-OFFERED','RC477-PRIVACY-RIDE',v_captain_one,'Captain One','01011112222',4.8,'SEDAN','Toyota Corolla','ABC-1234',95,8,'Offer details',pg_catalog.now()-interval '2 minutes','OFFERED'),
    ('RC477-ACCEPTED','RC477-PRIVACY-RIDE',v_captain_two,'Captain Two','01033334444',4.9,'SEDAN','Hyundai Elantra','XYZ-9876',100,5,'Accepted details',pg_catalog.now()-interval '1 minute','ACCEPTED');

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_customer::text,true);
  v_result := public.list_mantigo_customer_rides_backend(v_customer,'RC477-PRIVACY-RIDE');
  SELECT item->'bids' INTO v_bids
  FROM pg_catalog.jsonb_array_elements(v_result) AS rows(item)
  WHERE item->'ride'->>'id'='RC477-PRIVACY-RIDE';

  SELECT value INTO v_offered FROM pg_catalog.jsonb_array_elements(v_bids) AS bids(value)
  WHERE value->>'id'='RC477-OFFERED';
  SELECT value INTO v_accepted FROM pg_catalog.jsonb_array_elements(v_bids) AS bids(value)
  WHERE value->>'id'='RC477-ACCEPTED';

  IF v_offered IS NULL OR v_accepted IS NULL THEN
    RAISE EXCEPTION 'RC477_BID_RESPONSE_CONTRACT_BROKEN';
  END IF;
  IF v_offered->>'captain_phone' IS NOT NULL OR v_offered->>'vehicle_plate' IS NOT NULL
     OR NOT (v_offered ? 'captain_phone') OR NOT (v_offered ? 'vehicle_plate') THEN
    RAISE EXCEPTION 'RC477_UNACCEPTED_BID_CONTACT_LEAKED: %',v_offered;
  END IF;
  IF v_accepted->>'captain_phone'<>'01033334444' OR v_accepted->>'vehicle_plate'<>'XYZ-9876' THEN
    RAISE EXCEPTION 'RC477_ACCEPTED_BID_CONTACT_NOT_AVAILABLE: %',v_accepted;
  END IF;
  IF v_offered->>'captain_name'<>'Captain One'
     OR v_offered->>'vehicle_model'<>'Toyota Corolla'
     OR (v_offered->>'offered_price')::numeric<>95 THEN
    RAISE EXCEPTION 'RC477_NON_SENSITIVE_OFFER_FIELDS_CHANGED: %',v_offered;
  END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.list_mantigo_customer_rides_backend(v_captain_one,'RC477-PRIVACY-RIDE');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='UNAUTHORIZED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC477_CUSTOMER_RIDE_ACTOR_MISMATCH_NOT_REJECTED'; END IF;

  IF pg_catalog.has_function_privilege('anon','public.list_mantigo_customer_rides_backend(uuid,text)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.list_mantigo_customer_rides_backend(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'RC477_CUSTOMER_RIDE_RPC_GRANT_DRIFT';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid='public.list_mantigo_customer_rides_backend(uuid,text)'::regprocedure
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'RC477_CUSTOMER_RIDE_RPC_SEARCH_PATH_NOT_EMPTY';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'RC477 customer bid contact privacy integration: PASS' AS result;
