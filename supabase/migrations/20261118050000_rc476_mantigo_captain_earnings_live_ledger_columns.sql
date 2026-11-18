-- RC476: repair captain earnings aggregation against the canonical live ledger columns.
-- Forward-only; preserve the existing JSON response contract and actor ownership check.
BEGIN;

DO $preflight$
DECLARE v_missing text;
BEGIN
  SELECT string_agg(e.column_name, ', ' ORDER BY e.column_name)
    INTO v_missing
  FROM (VALUES
    ('id'),('ride_id'),('captain_id'),('gross_amount'),
    ('commission_amount'),('captain_net_amount'),
    ('payment_status'),('settlement_status')
  ) AS e(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute a
    WHERE a.attrelid=pg_catalog.to_regclass('public.mantigo_financial_ledger')
      AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC476_LEDGER_COLUMNS_MISSING: %',v_missing;
  END IF;
  IF pg_catalog.to_regclass('public.mantigo_captain_profiles') IS NULL
     OR pg_catalog.to_regclass('public.mantigo_rides') IS NULL
     OR pg_catalog.to_regclass('public.mantigo_bids') IS NULL THEN
    RAISE EXCEPTION 'RC476_MANTIGO_CAPTAIN_DEPENDENCY_MISSING';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.get_mantigo_captain_earnings_backend(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_auth uuid := auth.uid();
  v_total bigint;
  v_completed bigint;
  v_cancelled bigint;
  v_failed bigint;
  v_gross numeric := 0;
  v_commission numeric := 0;
  v_net numeric := 0;
  v_settled numeric := 0;
  v_unsettled numeric := 0;
  v_paid bigint := 0;
BEGIN
  IF v_auth IS NULL OR v_auth IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mantigo_captain_profiles
    WHERE captain_id=p_user_id
  ) THEN
    RAISE EXCEPTION 'CAPTAIN_PROFILE_REQUIRED';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.mantigo_rides r
  WHERE EXISTS (
    SELECT 1 FROM public.mantigo_bids b
    WHERE b.ride_id=r.id AND b.captain_id=p_user_id AND b.status='ACCEPTED'
  );

  SELECT count(*) INTO v_completed
  FROM public.mantigo_rides r
  WHERE r.status='COMPLETED' AND EXISTS (
    SELECT 1 FROM public.mantigo_bids b
    WHERE b.ride_id=r.id AND b.captain_id=p_user_id AND b.status='ACCEPTED'
  );

  SELECT count(*) INTO v_cancelled
  FROM public.mantigo_rides r
  WHERE r.status='CANCELLED' AND EXISTS (
    SELECT 1 FROM public.mantigo_bids b
    WHERE b.ride_id=r.id AND b.captain_id=p_user_id AND b.status='ACCEPTED'
  );

  SELECT count(*) INTO v_failed
  FROM public.mantigo_rides r
  WHERE r.status IN ('FAILED','SHOW_NO') AND EXISTS (
    SELECT 1 FROM public.mantigo_bids b
    WHERE b.ride_id=r.id AND b.captain_id=p_user_id AND b.status='ACCEPTED'
  );

  SELECT
    coalesce(sum(l.gross_amount),0),
    coalesce(sum(l.commission_amount),0),
    coalesce(sum(l.captain_net_amount),0),
    coalesce(sum(l.captain_net_amount) FILTER (WHERE l.settlement_status='SETTLED'),0),
    coalesce(sum(l.captain_net_amount) FILTER (WHERE l.settlement_status IS DISTINCT FROM 'SETTLED'),0),
    count(*) FILTER (WHERE l.payment_status IN ('PAID','CASH_CONFIRMED'))
  INTO v_gross,v_commission,v_net,v_settled,v_unsettled,v_paid
  FROM public.mantigo_financial_ledger l
  WHERE l.captain_id=p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'rides_total',v_total,
    'completed',v_completed,
    'cancelled',v_cancelled,
    'failed',v_failed,
    'gross',v_gross,
    'commission',v_commission,
    'net',v_net,
    'settled',v_settled,
    'unsettled',v_unsettled,
    'paid_rides',v_paid
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) IS
  'RC476: captain earnings aggregate uses canonical gross_amount, commission_amount and captain_net_amount ledger columns; caller is bound to auth.uid().';

COMMIT;
