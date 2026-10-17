-- TEST-ONLY compatibility baseline for disposable migration-chain replay.
-- Source: production schema-only snapshot captured 2026-10-17T02:10:22Z,
-- at migration ledger checkpoint 20261008222845 (283 versions), snapshot blob
-- 8d096904c777b4c7eae096014b45c59859c96cee in PR #284.
-- This is the observed live function definition before the source-only RC446
-- privacy replacement. It is NOT claimed to be the original creation migration.
-- The replay workflow copies this file to a temporary migration version
-- immediately before 20261006101048, solely so the historical GRANT can run.
-- Never apply this file to production or include it in the production ledger.

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
SET search_path = public
AS $function$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
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
    count(b.id)::bigint
  FROM public.mantigo_rides r
  LEFT JOIN public.mantigo_bids b
    ON b.ride_id = r.id
   AND b.status = 'OFFERED'
  WHERE r.status IN ('OPEN', 'OPEN_FOR_BIDS')
    AND r.customer_id <> p_user_id
  GROUP BY r.id
  ORDER BY r.created_at DESC
  LIMIT 100;
END;
$function$;
