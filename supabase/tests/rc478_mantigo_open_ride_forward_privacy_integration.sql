-- RC478 disposable integration: prove the forward open-ride privacy boundary.
-- Run only after RC446/RC477 fixtures and the RC478 migration on PostgreSQL test DB.
BEGIN;
DO $test$
DECLARE
  v_sedan uuid := '30000000-0000-4000-8000-000000000481';
  v_suv uuid := '30000000-0000-4000-8000-000000000482';
  v_pending uuid := '30000000-0000-4000-8000-000000000483';
  v_unverified uuid := '30000000-0000-4000-8000-000000000484';
  v_offline uuid := '30000000-0000-4000-8000-000000000485';
  v_customer uuid := '30000000-0000-4000-8000-000000000486';
  v_count integer;
  v_config text;
  v_rejected boolean;
BEGIN
  IF pg_catalog.has_function_privilege('anon','public.list_open_mantigo_rides_backend(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC478 anon must not execute open-ride RPC';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated','public.list_open_mantigo_rides_backend(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC478 authenticated execute grant missing';
  END IF;
  SELECT pg_catalog.array_to_string(p.proconfig,',') INTO v_config
  FROM pg_catalog.pg_proc p
  WHERE p.oid='public.list_open_mantigo_rides_backend(uuid)'::regprocedure
    AND p.prosecdef;
  IF v_config IS DISTINCT FROM 'search_path=pg_catalog' THEN
    RAISE EXCEPTION 'RC478 exact search_path mismatch: %',v_config;
  END IF;

  INSERT INTO public.mantigo_captain_profiles(captain_id,status,verification_status,availability_status,vehicle_category)
  VALUES
    (v_sedan,'ACTIVE','VERIFIED','AVAILABLE','SEDAN'),
    (v_suv,'ACTIVE','VERIFIED','AVAILABLE','SUV'),
    (v_pending,'PENDING','PENDING','AVAILABLE','SEDAN'),
    (v_unverified,'ACTIVE','UNVERIFIED','AVAILABLE','SEDAN'),
    (v_offline,'ACTIVE','VERIFIED','OFFLINE','SEDAN');

  INSERT INTO public.mantigo_rides(id,customer_id,customer_name,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status,created_at)
  VALUES
    ('RC478-SEDAN-OPEN',v_customer,'Customer Sedan','SEDAN','CITY','Sedan Pickup','Sedan Destination',120,'','OPEN',pg_catalog.now()-interval '3 minutes'),
    ('RC478-SUV-OPEN',v_customer,'Customer SUV','SUV','CITY','SUV Pickup','SUV Destination',150,'','OPEN_FOR_BIDS',pg_catalog.now()-interval '2 minutes'),
    ('RC478-SEDAN-CLOSED',v_customer,'Customer Closed','SEDAN','CITY','Closed Pickup','Closed Destination',90,'','ACCEPTED',pg_catalog.now()-interval '1 minute'),
    ('RC478-OWN-RIDE',v_sedan,'Captain Own','SEDAN','CITY','Private Pickup','Private Destination',80,'','OPEN',pg_catalog.now());
  INSERT INTO public.mantigo_bids(id,ride_id,status)
  VALUES ('RC478-SEDAN-BID','RC478-SEDAN-OPEN','OFFERED');

  -- No profile: authenticated customer is not entitled to all pickup/destination data.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_customer::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims','{"is_anonymous":false}',true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_customer);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_CAPTAIN_PROFILE_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC478 ordinary user read customer pickup/destination data'; END IF;

  -- Pending, unverified and offline captains are denied.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_pending::text,true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_pending);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_CAPTAIN_PROFILE_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC478 pending captain was allowed'; END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_unverified::text,true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_unverified);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_CAPTAIN_PROFILE_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC478 unverified captain was allowed'; END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_offline::text,true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_offline);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_CAPTAIN_PROFILE_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC478 offline captain was allowed'; END IF;

  -- Even a profile-qualified actor cannot use an anonymous Auth JWT.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_sedan::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims','{"is_anonymous":true}',true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_sedan);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_AUTH_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC478 anonymous Auth captain was allowed'; END IF;

  -- A verified, available SEDAN captain sees only eligible, open SEDAN rides.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_sedan::text,true);
  PERFORM pg_catalog.set_config('request.jwt.claims','{"is_anonymous":false}',true);
  SELECT count(*) INTO v_count FROM public.list_open_mantigo_rides_backend(v_sedan);
  IF v_count<>1 THEN RAISE EXCEPTION 'RC478 sedan captain expected one eligible ride, got %',v_count; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.list_open_mantigo_rides_backend(v_sedan) WHERE id='RC478-SEDAN-OPEN' AND bid_count=1) THEN
    RAISE EXCEPTION 'RC478 expected sedan ride or offered bid count missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.list_open_mantigo_rides_backend(v_sedan) WHERE id IN ('RC478-SUV-OPEN','RC478-SEDAN-CLOSED','RC478-OWN-RIDE')) THEN
    RAISE EXCEPTION 'RC478 sedan query included wrong vehicle, closed or own ride';
  END IF;

  -- A verified, available SUV captain sees only the SUV request.
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_suv::text,true);
  SELECT count(*) INTO v_count FROM public.list_open_mantigo_rides_backend(v_suv);
  IF v_count<>1 OR NOT EXISTS (SELECT 1 FROM public.list_open_mantigo_rides_backend(v_suv) WHERE id='RC478-SUV-OPEN') THEN
    RAISE EXCEPTION 'RC478 SUV category scope failed';
  END IF;
END;
$test$;
ROLLBACK;
SELECT 'RC478 forward open-ride privacy integration: PASS' AS result;
