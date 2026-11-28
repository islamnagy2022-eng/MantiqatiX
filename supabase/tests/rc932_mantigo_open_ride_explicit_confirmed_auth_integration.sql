-- RC932: strict confirmed-identity gate for MantiGO open-ride location disclosure.
-- Disposable PostgreSQL 17 only; exercise missing, null, true and explicit-false JWT claims.
BEGIN;
-- Supply only the Auth principal key required by this disposable fixture.
-- Vanilla PostgreSQL CI owns its fresh auth schema; Supabase replay uses the
-- schema owner when the current runner role cannot create objects there.
DO $auth_fixture$
DECLARE
  v_schema_owner name;
  v_runner name := current_user;
BEGIN
  IF pg_catalog.to_regclass('auth.users') IS NULL THEN
    IF pg_catalog.has_schema_privilege(current_user, 'auth', 'CREATE') THEN
      EXECUTE 'CREATE TABLE auth.users (id uuid PRIMARY KEY)';
    ELSE
      SELECT r.rolname INTO v_schema_owner
      FROM pg_catalog.pg_namespace n
      JOIN pg_catalog.pg_roles r ON r.oid = n.nspowner
      WHERE n.nspname = 'auth';

      IF v_schema_owner IS NULL
         OR NOT pg_catalog.pg_has_role(current_user, v_schema_owner, 'MEMBER') THEN
        RAISE EXCEPTION 'RC932_TEST_AUTH_FIXTURE_CANNOT_CREATE_AUTH_USERS';
      END IF;

      EXECUTE pg_catalog.format('SET ROLE %I', v_schema_owner);
      EXECUTE 'CREATE TABLE auth.users (id uuid PRIMARY KEY)';
      EXECUTE pg_catalog.format('GRANT SELECT, INSERT, UPDATE, DELETE ON auth.users TO %I', v_runner);
      EXECUTE 'RESET ROLE';
    END IF;
  END IF;
END;
$auth_fixture$;
DO $test$
DECLARE
  v_captain uuid := '30000000-0000-4000-8000-000000000481';
  v_customer uuid := '30000000-0000-4000-8000-000000000486';
  v_rejected boolean;
  v_count integer;
BEGIN
  IF pg_catalog.has_function_privilege('anon','public.list_open_mantigo_rides_backend(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC932 anon EXECUTE must remain denied';
  END IF;
  IF NOT pg_catalog.has_function_privilege('authenticated','public.list_open_mantigo_rides_backend(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'RC932 authenticated EXECUTE must remain enabled';
  END IF;

  -- Seed both synthetic principals in the Auth schema before inserting rows
  -- whose foreign keys reference auth.users.
  INSERT INTO auth.users(id)
  VALUES (v_captain),(v_customer)
  ON CONFLICT (id) DO NOTHING;

  -- Minimal disposable trigger prerequisite; the standalone RC446 workflow does not replay RC070.
  IF pg_catalog.to_regclass('public.mantigo_rate_limit_config') IS NULL THEN
    EXECUTE 'CREATE TABLE public.mantigo_rate_limit_config (
      action text PRIMARY KEY,
      max_events integer NOT NULL CHECK (max_events > 0),
      window_minutes integer NOT NULL CHECK (window_minutes > 0)
    )';
  END IF;

  -- Seed the trigger prerequisite transactionally.
  INSERT INTO public.mantigo_rate_limit_config(action,max_events,window_minutes)
  VALUES ('CREATE_RIDE',10,60)
  ON CONFLICT (action) DO NOTHING;

  INSERT INTO public.mantigo_captain_profiles(
    captain_id,status,verification_status,availability_status,vehicle_category
  ) VALUES (v_captain,'ACTIVE','VERIFIED','AVAILABLE','SEDAN')
  ON CONFLICT (captain_id) DO UPDATE SET
    status=excluded.status,
    verification_status=excluded.verification_status,
    availability_status=excluded.availability_status,
    vehicle_category=excluded.vehicle_category;

  INSERT INTO public.mantigo_rides(
    id,customer_id,customer_name,vehicle_category,ride_type,
    pickup_location,destination_location,proposed_price,note,status,created_at
  ) VALUES (
    'RC932-STRICT-AUTH-OPEN',v_customer,'Fixture Customer','SEDAN','CITY',
    'Fixture Pickup','Fixture Destination',100,'','OPEN',pg_catalog.now()
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_captain::text,true);

  -- Missing is_anonymous claim must be denied; it is not equivalent to false.
  PERFORM pg_catalog.set_config('request.jwt.claims','{}',true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_captain);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_AUTH_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC932 missing is_anonymous claim was allowed'; END IF;

  -- Explicit JSON null must also be denied.
  PERFORM pg_catalog.set_config('request.jwt.claims','{"is_anonymous":null}',true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_captain);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_AUTH_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC932 null is_anonymous claim was allowed'; END IF;

  -- Anonymous Auth identity remains denied.
  PERFORM pg_catalog.set_config('request.jwt.claims','{"is_anonymous":true}',true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_captain);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='MANTIGO_AUTH_REQUIRED' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC932 anonymous Auth identity was allowed'; END IF;

  -- An explicitly confirmed token still cannot pass another user's identifier.
  PERFORM pg_catalog.set_config('request.jwt.claims','{"is_anonymous":false}',true);
  v_rejected:=false;
  BEGIN
    PERFORM * FROM public.list_open_mantigo_rides_backend(v_customer);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='USER_CONTEXT_MISMATCH' THEN v_rejected:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_rejected THEN RAISE EXCEPTION 'RC932 caller identity mismatch was allowed'; END IF;

  -- Only explicit is_anonymous=false preserves the verified captain's existing access.
  SELECT count(*) INTO v_count
    FROM public.list_open_mantigo_rides_backend(v_captain)
   WHERE id='RC932-STRICT-AUTH-OPEN';
  IF v_count<>1 THEN
    RAISE EXCEPTION 'RC932 confirmed captain compatibility failed; expected one eligible ride, got %',v_count;
  END IF;
END;
$test$;
ROLLBACK;
SELECT 'RC932 MantiGO explicit confirmed identity integration: PASS' AS result;
