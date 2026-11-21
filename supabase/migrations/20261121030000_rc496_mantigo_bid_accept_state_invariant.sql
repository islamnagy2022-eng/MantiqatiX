-- RC496: enforce OFFERED-only MantiGO bid acceptance and serialize per-ride winners.
-- Forward-only replacement; historical MantiGO migrations remain immutable.

BEGIN;

DO $preflight$
BEGIN
  IF pg_catalog.to_regprocedure('public.accept_mantigo_bid_backend(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'RC496_ACCEPT_BID_FUNCTION_MISSING';
  END IF;
  IF pg_catalog.to_regprocedure('public.lock_mantigo_fare_backend(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'RC496_FARE_LOCK_FUNCTION_MISSING';
  END IF;
  IF pg_catalog.to_regprocedure('public.mantigo_accept_bid(text,text)') IS NULL
     OR pg_catalog.to_regprocedure('public.mantigo_submit_bid(text,numeric,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'RC496_LEGACY_BID_RPC_BOUNDARY_FUNCTION_MISSING';
  END IF;
  IF pg_catalog.to_regclass('public.mantigo_rides') IS NULL
     OR pg_catalog.to_regclass('public.mantigo_bids') IS NULL THEN
    RAISE EXCEPTION 'RC496_MANTIGO_TABLES_MISSING';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='mantigo_rides'
      AND column_name IN ('id','customer_id','status','accepted_bid_id','updated_at')
    GROUP BY table_name HAVING count(DISTINCT column_name)=5
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='mantigo_bids'
      AND column_name IN ('id','ride_id','captain_id','offered_price','status')
    GROUP BY table_name HAVING count(DISTINCT column_name)=5
  ) THEN
    RAISE EXCEPTION 'RC496_MANTIGO_STATE_SCHEMA_NOT_READY';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='mantigo_financial_ledger'
      AND column_name IN (
        'id','ride_id','customer_id','captain_id','currency','gross_amount',
        'commission_amount','captain_net_amount','payment_status',
        'settlement_status','idempotency_key','metadata'
      )
    GROUP BY table_name HAVING count(DISTINCT column_name)=12
  ) THEN
    RAISE EXCEPTION 'RC496_MANTIGO_FINANCIAL_LEDGER_SCHEMA_NOT_READY';
  END IF;
END;
$preflight$;

-- The fare-lock helper is part of the acceptance state machine. Replacing its
-- blind "row exists => idempotent" branch prevents an unrelated/stale ledger row
-- from being accepted as the financial record for a different winning captain.
CREATE OR REPLACE FUNCTION public.lock_mantigo_fare_backend(
  p_user_id uuid,
  p_ride_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer uuid;
  v_captain uuid;
  v_amount numeric;
  v_status text;
  v_bid text;
  v_id text;
  v_key text;
  v_existing public.mantigo_financial_ledger%rowtype;
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;

  SELECT r.customer_id,r.status,r.accepted_bid_id,b.captain_id,b.offered_price
    INTO v_customer,v_status,v_bid,v_captain,v_amount
  FROM public.mantigo_rides r
  JOIN public.mantigo_bids b ON b.id=r.accepted_bid_id AND b.ride_id=r.id
  WHERE r.id=p_ride_id
  FOR UPDATE OF r;

  IF v_customer IS NULL OR v_bid IS NULL THEN
    RAISE EXCEPTION 'RIDE_OR_ACCEPTED_BID_NOT_FOUND';
  END IF;
  IF p_user_id IS DISTINCT FROM v_customer THEN
    RAISE EXCEPTION 'CUSTOMER_REQUIRED';
  END IF;
  IF v_status IS DISTINCT FROM 'ACCEPTED' THEN
    RAISE EXCEPTION 'RIDE_MUST_BE_ACCEPTED';
  END IF;
  IF v_amount IS NULL OR v_amount<=0 THEN
    RAISE EXCEPTION 'INVALID_FARE';
  END IF;

  v_key:='MGO-FARE-'||p_ride_id;
  SELECT * INTO v_existing
  FROM public.mantigo_financial_ledger
  WHERE ride_id=p_ride_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_customer
       OR v_existing.captain_id IS DISTINCT FROM v_captain
       OR v_existing.currency IS DISTINCT FROM 'EGP'
       OR v_existing.gross_amount IS DISTINCT FROM v_amount
       OR v_existing.commission_amount IS DISTINCT FROM 0::numeric
       OR v_existing.captain_net_amount IS DISTINCT FROM v_amount
       OR v_existing.idempotency_key IS DISTINCT FROM v_key
       OR v_existing.metadata->>'accepted_bid_id' IS DISTINCT FROM v_bid
       OR v_existing.metadata->>'source' IS DISTINCT FROM 'MANTIGO_ACCEPT' THEN
      RAISE EXCEPTION 'MANTIGO_FINANCIAL_IDENTITY_MISMATCH';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'id',v_existing.id,'ride_id',p_ride_id,'gross_amount',v_existing.gross_amount,
      'payment_status',v_existing.payment_status,
      'settlement_status',v_existing.settlement_status,'idempotent',true
    );
  END IF;

  v_id:='MGO-FIN-'||pg_catalog.upper(
    pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,16)
  );

  INSERT INTO public.mantigo_financial_ledger(
    id,ride_id,customer_id,captain_id,currency,gross_amount,commission_amount,
    captain_net_amount,payment_status,settlement_status,idempotency_key,metadata
  ) VALUES (
    v_id,p_ride_id,v_customer,v_captain,'EGP',v_amount,0,v_amount,
    'REQUIRED','NOT_READY',v_key,
    pg_catalog.jsonb_build_object(
      'fare_locked',true,'accepted_bid_id',v_bid,'source','MANTIGO_ACCEPT'
    )
  );

  INSERT INTO public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) VALUES (
    'AUD-MG-'||pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),
    'MNTY-PLATFORM',p_user_id,'MANTIGO_FARE_LOCKED','MANTIGO_FINANCIAL',v_id,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object(
      'ride_id',p_ride_id,'gross_amount',v_amount,'payment_status','REQUIRED',
      'captain_id',v_captain,'accepted_bid_id',v_bid
    ),
    'SUCCESS'
  );

  RETURN pg_catalog.jsonb_build_object(
    'id',v_id,'ride_id',p_ride_id,'gross_amount',v_amount,
    'payment_status','REQUIRED','settlement_status','NOT_READY','idempotent',false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_mantigo_bid_backend(
  p_user_id uuid,
  p_ride_id text,
  p_bid_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text;
  v_customer uuid;
  v_accepted_bid_id text;
  v_bid_status text;
  v_captain uuid;
  v_price numeric;
  v_fin jsonb;
  v_rows integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;

  -- Lock the ride first. This serializes all winner selection attempts for the
  -- same ride, even when competing callers request different OFFERED bids.
  SELECT r.status,r.customer_id,r.accepted_bid_id
    INTO v_status,v_customer,v_accepted_bid_id
  FROM public.mantigo_rides r
  WHERE r.id=p_ride_id
  FOR UPDATE;

  IF v_status IS NULL THEN RAISE EXCEPTION 'RIDE_OR_BID_NOT_FOUND'; END IF;
  IF v_customer IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'CUSTOMER_REQUIRED'; END IF;

  -- A retry of the exact winning bid is idempotent; a different bid cannot
  -- replace the winner after acceptance.
  IF v_status='ACCEPTED' AND v_accepted_bid_id=p_bid_id THEN
    SELECT b.status,b.captain_id,b.offered_price
      INTO v_bid_status,v_captain,v_price
    FROM public.mantigo_bids b
    WHERE b.id=p_bid_id AND b.ride_id=p_ride_id
    FOR UPDATE;
    IF v_bid_status IS DISTINCT FROM 'ACCEPTED' THEN
      RAISE EXCEPTION 'RIDE_ACCEPTANCE_STATE_MISMATCH';
    END IF;
    v_fin := public.lock_mantigo_fare_backend(p_user_id,p_ride_id);
    RETURN pg_catalog.jsonb_build_object(
      'id',p_ride_id,'accepted_bid_id',p_bid_id,'status','ACCEPTED',
      'financial',v_fin,'idempotent',true
    );
  END IF;

  IF v_status NOT IN ('OPEN','OPEN_FOR_BIDS','MATCHING') THEN
    RAISE EXCEPTION 'RIDE_NOT_OPEN';
  END IF;
  IF v_accepted_bid_id IS NOT NULL THEN
    RAISE EXCEPTION 'RIDE_ACCEPTANCE_STATE_MISMATCH';
  END IF;
  -- Refuse to create a second winner if legacy/corrupt state already contains an
  -- ACCEPTED bid while the ride row is still OPEN and accepted_bid_id is NULL.
  IF EXISTS (
    SELECT 1 FROM public.mantigo_bids b
    WHERE b.ride_id=p_ride_id AND b.status='ACCEPTED'
  ) THEN
    RAISE EXCEPTION 'RIDE_ACCEPTANCE_STATE_MISMATCH';
  END IF;

  SELECT b.status,b.captain_id,b.offered_price
    INTO v_bid_status,v_captain,v_price
  FROM public.mantigo_bids b
  WHERE b.id=p_bid_id AND b.ride_id=p_ride_id
  FOR UPDATE;

  IF v_bid_status IS NULL THEN RAISE EXCEPTION 'RIDE_OR_BID_NOT_FOUND'; END IF;
  IF v_bid_status IS DISTINCT FROM 'OFFERED' THEN
    RAISE EXCEPTION 'BID_NOT_OFFERED';
  END IF;

  -- Conditional state transition is retained as a second line of defense even
  -- though the ride lock serializes the normal acceptance path.
  UPDATE public.mantigo_bids
  SET status='ACCEPTED'
  WHERE id=p_bid_id AND ride_id=p_ride_id AND status='OFFERED';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'BID_ACCEPTANCE_RACE_LOST'; END IF;

  UPDATE public.mantigo_bids
  SET status='REJECTED'
  WHERE ride_id=p_ride_id AND status='OFFERED' AND id<>p_bid_id;

  UPDATE public.mantigo_rides
  SET accepted_bid_id=p_bid_id,status='ACCEPTED',updated_at=pg_catalog.now()
  WHERE id=p_ride_id
    AND customer_id=p_user_id
    AND status IN ('OPEN','OPEN_FOR_BIDS','MATCHING')
    AND accepted_bid_id IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'RIDE_ACCEPTANCE_RACE_LOST'; END IF;

  -- Financial lock is called only after the accepted bid and ride winner are
  -- persisted in this transaction; any failure rolls the whole transition back.
  v_fin := public.lock_mantigo_fare_backend(p_user_id,p_ride_id);

  INSERT INTO public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,
    old_values,new_values,result
  ) VALUES (
    'AUD-MG-'||pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),
    'MNTY-PLATFORM',p_user_id,'MANTIGO_BID_ACCEPTED','MANTIGO_RIDE',p_ride_id,
    pg_catalog.jsonb_build_object('status',v_status),
    pg_catalog.jsonb_build_object(
      'status','ACCEPTED','accepted_bid_id',p_bid_id,
      'captain_id',v_captain,'fare',v_fin
    ),
    'SUCCESS'
  );

  BEGIN
    INSERT INTO public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id
    ) VALUES (
      'NTF-'||pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),
      'MNTY-PLATFORM',v_captain,'MANTIGO_ACCEPTED',
      'تم قبول عرضك في MantiGO',
      'تم قبول عرضك للرحلة بقيمة '||pg_catalog.to_char(v_price,'FM999999990D00')||' ج.م',
      'MANTIGO_RIDE',p_ride_id
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.audit_logs(
      id,tenant_id,actor_user_id,action,entity_type,entity_id,
      old_values,new_values,result
    ) VALUES (
      'AUD-MG-'||pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),
      'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED',
      'MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      pg_catalog.jsonb_build_object(
        'notification_type','MANTIGO_ACCEPTED','error',SQLERRM
      ),
      'PARTIAL'
    );
  END;

  RETURN pg_catalog.jsonb_build_object(
    'id',p_ride_id,'accepted_bid_id',p_bid_id,'status','ACCEPTED',
    'financial',v_fin,'idempotent',false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_mantigo_bid_backend(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_mantigo_bid_backend(uuid,text,text) TO authenticated;
-- These legacy SECURITY DEFINER endpoints were already revoked from client roles;
-- keep them pinned so the canonical backend RPC remains the only client acceptance path.
REVOKE ALL ON FUNCTION public.mantigo_accept_bid(text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mantigo_submit_bid(text,numeric,text,text,text,text) FROM PUBLIC,anon,authenticated;

COMMENT ON FUNCTION public.accept_mantigo_bid_backend(uuid,text,text) IS
  'RC496: a ride owner may accept only an OFFERED bid; a per-ride row lock serializes competing winners and same-bid retries are idempotent.';

COMMIT;
