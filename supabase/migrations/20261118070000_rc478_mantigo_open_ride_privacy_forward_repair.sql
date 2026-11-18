-- RC478: forward repair of the live open-ride location disclosure boundary.
-- RC446's original source identity is absent from the live migration ledger; this
-- later migration restores the same captain gate and narrows results to eligible
-- vehicle category, while explicitly rejecting anonymous Auth sessions.
BEGIN;

DO $preflight$
DECLARE v_missing text;
BEGIN
  WITH expected(table_name,column_name) AS (
    VALUES
      ('mantigo_captain_profiles','captain_id'),
      ('mantigo_captain_profiles','status'),
      ('mantigo_captain_profiles','verification_status'),
      ('mantigo_captain_profiles','availability_status'),
      ('mantigo_captain_profiles','vehicle_category'),
      ('mantigo_rides','id'),
      ('mantigo_rides','customer_id'),
      ('mantigo_rides','customer_name'),
      ('mantigo_rides','vehicle_category'),
      ('mantigo_rides','ride_type'),
      ('mantigo_rides','pickup_location'),
      ('mantigo_rides','destination_location'),
      ('mantigo_rides','proposed_price'),
      ('mantigo_rides','note'),
      ('mantigo_rides','status'),
      ('mantigo_rides','created_at'),
      ('mantigo_bids','id'),
      ('mantigo_bids','ride_id'),
      ('mantigo_bids','status')
  )
  SELECT string_agg(e.table_name||'.'||e.column_name,', ' ORDER BY e.table_name,e.column_name)
    INTO v_missing
  FROM expected e
  LEFT JOIN pg_catalog.pg_attribute a
    ON a.attrelid=pg_catalog.to_regclass('public.'||e.table_name)
   AND a.attname=e.column_name
   AND a.attnum>0
   AND NOT a.attisdropped
  WHERE a.attname IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC478_OPEN_RIDE_SCHEMA_DEPENDENCY_MISSING: %',v_missing;
  END IF;

  IF pg_catalog.to_regprocedure('public.list_open_mantigo_rides_backend(uuid)') IS NULL THEN
    RAISE EXCEPTION 'RC478_OPEN_RIDE_RPC_MISSING';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.list_open_mantigo_rides_backend(p_user_id uuid)
RETURNS TABLE(
  id text,
  customer_name text,
  vehicle_category text,
  ride_type text,
  pickup_location text,
  destination_location text,
  proposed_price numeric,
  note text,
  status text,
  created_at timestamptz,
  bid_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_vehicle_category text;
BEGIN
  IF auth.uid() IS NULL
     OR pg_catalog.coalesce((auth.jwt()->>'is_anonymous')::boolean,false) THEN
    RAISE EXCEPTION 'MANTIGO_AUTH_REQUIRED';
  END IF;

  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;

  SELECT cp.vehicle_category
    INTO v_vehicle_category
  FROM public.mantigo_captain_profiles cp
  WHERE cp.captain_id=p_user_id
    AND cp.status='ACTIVE'
    AND cp.verification_status='VERIFIED'
    AND cp.availability_status='AVAILABLE';

  IF NOT FOUND OR pg_catalog.nullif(pg_catalog.btrim(v_vehicle_category),'') IS NULL THEN
    RAISE EXCEPTION 'MANTIGO_CAPTAIN_PROFILE_REQUIRED';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.customer_name,
    r.vehicle_category,
    r.ride_type,
    r.pickup_location,
    r.destination_location,
    r.proposed_price,
    r.note,
    r.status,
    r.created_at,
    pg_catalog.count(b.id)::bigint
  FROM public.mantigo_rides r
  LEFT JOIN public.mantigo_bids b
    ON b.ride_id=r.id
   AND b.status='OFFERED'
  WHERE r.status IN ('OPEN','OPEN_FOR_BIDS')
    AND r.customer_id<>p_user_id
    AND r.vehicle_category=v_vehicle_category
  GROUP BY
    r.id,r.customer_name,r.vehicle_category,r.ride_type,
    r.pickup_location,r.destination_location,r.proposed_price,
    r.note,r.status,r.created_at
  ORDER BY r.created_at DESC
  LIMIT 100;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_open_mantigo_rides_backend(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_open_mantigo_rides_backend(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_open_mantigo_rides_backend(uuid) IS
  'RC478: exposes open pickup/destination details only to a non-anonymous active, verified, available captain, and only for that captain vehicle category.';

COMMIT;
