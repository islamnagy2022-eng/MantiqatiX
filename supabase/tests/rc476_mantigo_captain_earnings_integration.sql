-- RC476 disposable PostgreSQL integration test. Never run against Production.
BEGIN;

DO $test$
DECLARE
  v_captain uuid := '10000000-0000-4000-8000-000000000060';
  v_other uuid := '10000000-0000-4000-8000-000000000061';
  v_result jsonb;
  v_rejected boolean := false;
BEGIN
  INSERT INTO public.mantigo_captain_profiles(captain_id) VALUES(v_captain);

  INSERT INTO public.mantigo_rides(id,customer_id,status) VALUES
    ('RC476-RIDE-1',v_other,'COMPLETED'),
    ('RC476-RIDE-2',v_other,'CANCELLED'),
    ('RC476-RIDE-3',v_other,'FAILED');

  INSERT INTO public.mantigo_bids(ride_id,captain_id,status) VALUES
    ('RC476-RIDE-1',v_captain,'ACCEPTED'),
    ('RC476-RIDE-2',v_captain,'ACCEPTED'),
    ('RC476-RIDE-3',v_captain,'ACCEPTED');

  -- Deliberately conflicting legacy values prove that the RPC reads only
  -- canonical live columns, not the removed amount/captain_amount names.
  INSERT INTO public.mantigo_financial_ledger(
    id,ride_id,captain_id,gross_amount,commission_amount,captain_net_amount,
    payment_status,settlement_status,amount,captain_amount
  ) VALUES
    ('RC476-FIN-1','RC476-RIDE-1',v_captain,100,30,70,'PAID','SETTLED',999,888),
    ('RC476-FIN-2','RC476-RIDE-2',v_captain,200,20,180,'REQUIRED','READY',777,666),
    ('RC476-FIN-3','RC476-RIDE-3',v_other,500,50,450,'PAID','SETTLED',555,444);

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_captain::text,false);
  v_result := public.get_mantigo_captain_earnings_backend(v_captain);

  IF (v_result->>'rides_total')::bigint<>3
     OR (v_result->>'completed')::bigint<>1
     OR (v_result->>'cancelled')::bigint<>1
     OR (v_result->>'failed')::bigint<>1
     OR (v_result->>'gross')::numeric<>300
     OR (v_result->>'commission')::numeric<>50
     OR (v_result->>'net')::numeric<>250
     OR (v_result->>'settled')::numeric<>70
     OR (v_result->>'unsettled')::numeric<>180
     OR (v_result->>'paid_rides')::bigint<>1 THEN
    RAISE EXCEPTION 'RC476_EARNINGS_AGGREGATE_MISMATCH: %',v_result;
  END IF;

  v_rejected:=false;
  BEGIN
    PERFORM public.get_mantigo_captain_earnings_backend(v_other);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='AUTH_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC476_USER_CONTEXT_MISMATCH_NOT_REJECTED'; END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_other::text,false);
  v_rejected:=false;
  BEGIN
    PERFORM public.get_mantigo_captain_earnings_backend(v_other);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='CAPTAIN_PROFILE_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC476_MISSING_CAPTAIN_PROFILE_NOT_REJECTED'; END IF;

  IF pg_catalog.has_function_privilege('anon','public.get_mantigo_captain_earnings_backend(uuid)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('authenticated','public.get_mantigo_captain_earnings_backend(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC476_EARNINGS_RPC_GRANT_DRIFT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p
    WHERE p.oid='public.get_mantigo_captain_earnings_backend(uuid)'::regprocedure
      AND p.proconfig @> ARRAY['search_path=""']
  ) THEN
    RAISE EXCEPTION 'RC476_EARNINGS_RPC_SEARCH_PATH_NOT_EMPTY';
  END IF;
END;
$test$;

ROLLBACK;
SELECT 'RC476 captain earnings canonical ledger integration: PASS' AS result;
