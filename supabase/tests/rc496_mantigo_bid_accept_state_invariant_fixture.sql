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

CREATE OR REPLACE FUNCTION public.mantigo_accept_bid(p_ride_id text,p_bid_id text)
RETURNS void LANGUAGE plpgsql AS $function$ BEGIN RETURN; END; $function$;

CREATE OR REPLACE FUNCTION public.create_mantigo_bid_backend(
  p_user_id uuid,p_ride_id text,p_captain_name text,p_captain_phone text,
  p_captain_rating numeric,p_vehicle_category text,p_vehicle_model text,
  p_vehicle_plate text,p_offered_price numeric,p_eta_minutes integer,p_captain_message text
)
RETURNS jsonb LANGUAGE plpgsql AS $function$
BEGIN
  RETURN pg_catalog.jsonb_build_object('id','RC496-STUB','status','OFFERED');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mantigo_submit_bid(
  p_ride_id text,p_offered_price numeric,p_captain_name text,
  p_vehicle_category text,p_vehicle_model text,p_captain_message text
)
RETURNS text LANGUAGE sql AS $function$ SELECT NULL::text $function$;

CREATE TABLE public.mantigo_rides (
  id text PRIMARY KEY,
  customer_id uuid NOT NULL,
  vehicle_category text NOT NULL DEFAULT 'SEDAN',
  status text NOT NULL,
  accepted_bid_id text,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE public.mantigo_bids (
  id text PRIMARY KEY,
  ride_id text NOT NULL REFERENCES public.mantigo_rides(id),
  captain_id uuid NOT NULL,
  captain_name text NOT NULL DEFAULT '',
  captain_phone text NOT NULL DEFAULT '',
  captain_rating numeric NOT NULL DEFAULT 0,
  vehicle_category text NOT NULL DEFAULT 'SEDAN',
  vehicle_model text NOT NULL DEFAULT '',
  vehicle_plate text NOT NULL DEFAULT '',
  offered_price numeric NOT NULL,
  eta_minutes integer NOT NULL DEFAULT 0,
  captain_message text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('OFFERED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  UNIQUE (ride_id,captain_id)
);

CREATE TABLE public.mantigo_captain_profiles (
  captain_id uuid PRIMARY KEY,
  status text NOT NULL,
  verification_status text NOT NULL,
  availability_status text NOT NULL,
  vehicle_category text NOT NULL,
  vehicle_model text NOT NULL DEFAULT '',
  vehicle_plate text NOT NULL DEFAULT '',
  rating numeric NOT NULL DEFAULT 0
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

CREATE TABLE public.mantigo_financial_ledger (
  id text PRIMARY KEY,
  ride_id text NOT NULL UNIQUE REFERENCES public.mantigo_rides(id),
  customer_id uuid NOT NULL,
  captain_id uuid NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  gross_amount numeric NOT NULL,
  commission_amount numeric NOT NULL DEFAULT 0,
  captain_net_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'REQUIRED',
  settlement_status text NOT NULL DEFAULT 'NOT_READY',
  payment_reference text,
  settlement_reference text,
  idempotency_key text NOT NULL UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  commission_rate numeric,
  payment_confirmed_at timestamptz,
  provider text,
  provider_intent_id text,
  provider_transaction_id text
);

CREATE OR REPLACE FUNCTION public.lock_mantigo_fare_backend(p_user_id uuid,p_ride_id text)
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
  v_bid_id text;
  v_key text;
  v_existing public.mantigo_financial_ledger%rowtype;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  SELECT r.customer_id,r.status,r.accepted_bid_id,b.captain_id,b.offered_price
    INTO v_customer,v_status,v_bid_id,v_captain,v_amount
  FROM public.mantigo_rides r
  JOIN public.mantigo_bids b ON b.id=r.accepted_bid_id AND b.ride_id=r.id
  WHERE r.id=p_ride_id
  FOR UPDATE OF r;
  IF v_customer IS DISTINCT FROM p_user_id
     OR v_status IS DISTINCT FROM 'ACCEPTED'
     OR v_bid_id IS NULL THEN
    RAISE EXCEPTION 'RC496_FARE_LOCK_REQUIRES_ACCEPTED_WINNER';
  END IF;
  IF p_ride_id='RC496-FARE-FAIL' THEN
    RAISE EXCEPTION 'RC496_TEST_FARE_LOCK_FAILURE';
  END IF;

  v_key:='MGO-FARE-'||p_ride_id;
  SELECT * INTO v_existing FROM public.mantigo_financial_ledger
  WHERE ride_id=p_ride_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_customer
       OR v_existing.captain_id IS DISTINCT FROM v_captain
       OR v_existing.gross_amount IS DISTINCT FROM v_amount
       OR v_existing.captain_net_amount IS DISTINCT FROM v_amount
       OR v_existing.idempotency_key IS DISTINCT FROM v_key
       OR v_existing.metadata->>'accepted_bid_id' IS DISTINCT FROM v_bid_id
       OR v_existing.metadata->>'source' IS DISTINCT FROM 'MANTIGO_ACCEPT' THEN
      RAISE EXCEPTION 'MANTIGO_FINANCIAL_IDENTITY_MISMATCH';
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'id',v_existing.id,'ride_id',p_ride_id,'gross_amount',v_existing.gross_amount,
      'payment_status',v_existing.payment_status,
      'settlement_status',v_existing.settlement_status,'idempotent',true
    );
  END IF;

  INSERT INTO public.mantigo_financial_ledger(
    id,ride_id,customer_id,captain_id,currency,gross_amount,commission_amount,
    captain_net_amount,payment_status,settlement_status,idempotency_key,metadata
  ) VALUES (
    'MGO-FIN-'||pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text,'-',''),1,16)),
    p_ride_id,v_customer,v_captain,'EGP',v_amount,0,v_amount,'REQUIRED','NOT_READY',v_key,
    pg_catalog.jsonb_build_object('fare_locked',true,'accepted_bid_id',v_bid_id,'source','MANTIGO_ACCEPT')
  )
  RETURNING id INTO v_key;
  RETURN pg_catalog.jsonb_build_object(
    'id',v_key,'ride_id',p_ride_id,'gross_amount',v_amount,
    'payment_status','REQUIRED','settlement_status','NOT_READY','idempotent',false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.rc496_fail_fare_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.ride_id='RC496-FARE-FAIL' THEN
    RAISE EXCEPTION 'RC496_TEST_FARE_LOCK_FAILURE';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER rc496_fail_fare_lock_before_insert
BEFORE INSERT ON public.mantigo_financial_ledger
FOR EACH ROW
EXECUTE FUNCTION public.rc496_fail_fare_lock();

GRANT EXECUTE ON FUNCTION public.lock_mantigo_fare_backend(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) TO authenticated;
