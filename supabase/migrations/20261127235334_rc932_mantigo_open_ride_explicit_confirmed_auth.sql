-- RC932: require a positively confirmed Auth identity before exposing MantiGO open-ride locations.
-- Forward-only strict repair; do not edit historical RC478 migration history.
BEGIN;

DO $rc932_preflight$
DECLARE
  v_rpc oid := pg_catalog.to_regprocedure('public.list_open_mantigo_rides_backend(uuid)');
  v_missing text;
BEGIN
  IF v_rpc IS NULL THEN
    RAISE EXCEPTION 'RC932_OPEN_RIDE_RPC_MISSING';
  END IF;

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
  SELECT pg_catalog.string_agg(e.table_name||'.'||e.column_name,', ' ORDER BY e.table_name,e.column_name)
    INTO v_missing
    FROM expected e
    LEFT JOIN pg_catalog.pg_attribute a
      ON a.attrelid=pg_catalog.to_regclass('public.'||e.table_name)
     AND a.attname=e.column_name
     AND a.attnum>0
     AND NOT a.attisdropped
   WHERE a.attname IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC932_OPEN_RIDE_SCHEMA_DEPENDENCY_MISSING: %',v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc p
     WHERE p.oid=v_rpc
       AND p.prosecdef
       AND pg_catalog.has_function_privilege('authenticated',v_rpc,'EXECUTE')
       AND NOT pg_catalog.has_function_privilege('anon',v_rpc,'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'RC932_OPEN_RIDE_EXISTING_FUNCTION_SECURITY_CONTRACT_MISMATCH';
  END IF;
END;
$rc932_preflight$;

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
     OR (auth.jwt()->>'is_anonymous') IS DISTINCT FROM 'false' THEN
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

  IF NOT FOUND OR nullif(pg_catalog.btrim(v_vehicle_category),'') IS NULL THEN
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
  'RC932: rejects JWTs unless is_anonymous is explicitly false; preserves active verified available captain and vehicle-category filtering.';

COMMIT;
