-- RC477: hide captain contact and vehicle identifiers until the customer accepts the bid.
-- Preserve the customer ride JSON contract and expose those fields on the accepted bid only.
BEGIN;

DO $preflight$
DECLARE v_missing text;
BEGIN
  WITH expected(table_name,column_name) AS (
    VALUES
      ('mantigo_rides','id'),('mantigo_rides','customer_id'),('mantigo_rides','created_at'),
      ('mantigo_bids','id'),('mantigo_bids','ride_id'),('mantigo_bids','status'),
      ('mantigo_bids','created_at'),('mantigo_bids','captain_phone'),('mantigo_bids','vehicle_plate'),
      ('mantigo_financial_ledger','ride_id'),('mantigo_ride_ratings','ride_id'),('mantigo_ride_ratings','customer_id')
  )
  SELECT string_agg(e.table_name||'.'||e.column_name,', ' ORDER BY e.table_name,e.column_name)
    INTO v_missing
  FROM expected e
  LEFT JOIN pg_catalog.pg_attribute a
    ON a.attrelid=pg_catalog.to_regclass('public.'||e.table_name)
   AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped
  WHERE a.attname IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC477_CUSTOMER_RIDE_READ_DEPENDENCY_MISSING: %',v_missing;
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.list_mantigo_customer_rides_backend(
  p_user_id uuid,
  p_ride_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL OR p_user_id IS NULL OR v_user IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'ride',to_jsonb(r),
      'bids',coalesce((
        SELECT pg_catalog.jsonb_agg(
          (to_jsonb(b)-'captain_phone'-'vehicle_plate')
          || pg_catalog.jsonb_build_object(
            'captain_phone',CASE WHEN b.status='ACCEPTED' THEN b.captain_phone ELSE NULL END,
            'vehicle_plate',CASE WHEN b.status='ACCEPTED' THEN b.vehicle_plate ELSE NULL END
          )
          ORDER BY b.created_at ASC
        )
        FROM public.mantigo_bids b
        WHERE b.ride_id=r.id
      ),'[]'::jsonb),
      'financial',(
        SELECT to_jsonb(f) FROM public.mantigo_financial_ledger f WHERE f.ride_id=r.id
      ),
      'rating',(
        SELECT to_jsonb(rt) FROM public.mantigo_ride_ratings rt
        WHERE rt.ride_id=r.id AND rt.customer_id=v_user LIMIT 1
      )
    )
    ORDER BY r.created_at DESC
  ),'[]'::jsonb)
  INTO v_result
  FROM public.mantigo_rides r
  WHERE r.customer_id=v_user
    AND (p_ride_id IS NULL OR r.id=p_ride_id);

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_mantigo_customer_rides_backend(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_mantigo_customer_rides_backend(uuid,text) TO authenticated;

COMMENT ON FUNCTION public.list_mantigo_customer_rides_backend(uuid,text) IS
  'RC477: customer can read only own rides; captain phone and vehicle plate are returned only for an ACCEPTED bid.';

COMMIT;
