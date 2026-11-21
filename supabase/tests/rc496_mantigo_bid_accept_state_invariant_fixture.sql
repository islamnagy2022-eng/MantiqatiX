-- RC496 disposable PostgreSQL fixture only. Never apply to Production.
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid LANGUAGE sql STABLE
SET search_path TO ''
AS $function$
  SELECT nullif(pg_catalog.current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;

CREATE TABLE public.mantigo_rides (
  id text PRIMARY KEY,
  customer_id uuid NOT NULL,
  status text NOT NULL,
  accepted_bid_id text,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.mantigo_bids (
  id text PRIMARY KEY,
  ride_id text NOT NULL REFERENCES public.mantigo_rides(id),
  captain_id uuid NOT NULL,
  offered_price numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('OFFERED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED'))
);

CREATE TABLE public.audit_logs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  result text NOT NULL
);

CREATE TABLE public.notifications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL
);

CREATE TABLE public.rc496_financial_lock_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ride_id text NOT NULL,
  caller_id uuid NOT NULL,
  accepted_bid_id text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE OR REPLACE FUNCTION public.lock_mantigo_fare_backend(p_user_id uuid,p_ride_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_customer uuid;
  v_status text;
  v_bid_id text;
  v_bid_status text;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  SELECT r.customer_id,r.status,r.accepted_bid_id,b.status
    INTO v_customer,v_status,v_bid_id,v_bid_status
  FROM public.mantigo_rides r
  LEFT JOIN public.mantigo_bids b ON b.id=r.accepted_bid_id AND b.ride_id=r.id
  WHERE r.id=p_ride_id;
  IF v_customer IS DISTINCT FROM p_user_id
     OR v_status IS DISTINCT FROM 'ACCEPTED'
     OR v_bid_id IS NULL
     OR v_bid_status IS DISTINCT FROM 'ACCEPTED' THEN
    RAISE EXCEPTION 'RC496_FARE_LOCK_REQUIRES_ACCEPTED_WINNER';
  END IF;
  IF p_ride_id='RC496-FARE-FAIL' THEN
    RAISE EXCEPTION 'RC496_TEST_FARE_LOCK_FAILURE';
  END IF;
  INSERT INTO public.rc496_financial_lock_calls(ride_id,caller_id,accepted_bid_id)
  VALUES(p_ride_id,p_user_id,v_bid_id);
  RETURN pg_catalog.jsonb_build_object(
    'ride_id',p_ride_id,'accepted_bid_id',v_bid_id,'locked',true
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lock_mantigo_fare_backend(uuid,text) TO authenticated;
