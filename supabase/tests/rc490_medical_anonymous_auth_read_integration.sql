-- RC490 isolated integration. Run only after the complete disposable forward migration replay.
BEGIN;

DO $fixture$
DECLARE v_business uuid;
BEGIN
  SELECT b.id INTO v_business
  FROM public.businesses b
  WHERE b.tenant_id='MNTY-PLATFORM'
  ORDER BY b.id LIMIT 1;
  IF v_business IS NULL THEN
    RAISE EXCEPTION 'RC490_FIXTURE_BUSINESS_MISSING';
  END IF;

  INSERT INTO auth.users
    (id,aud,role,email,encrypted_password,email_confirmed_at,
     raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous)
  VALUES
    ('49000000-0000-4000-8000-000000000001','authenticated','authenticated',
     'rc490-medical@example.invalid','',now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"rc490_fixture":true}'::jsonb,now(),now(),false,false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_memberships
    (id,user_id,tenant_id,business_id,role,status)
  VALUES
    ('RC490-MEDICAL-PROVIDER-FIXTURE',
     '49000000-0000-4000-8000-000000000001',
     'MNTY-PLATFORM',v_business,'SERVICE_PROVIDER','ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.medical_appointments
    (id,tenant_id,business_id,patient_id,doctor_id,date_time,status,reason)
  VALUES
    ('RC490-ANON-APPOINTMENT','MNTY-PLATFORM',v_business,
     '49000000-0000-4000-8000-000000000001',
     'RC490-DOCTOR-FIXTURE',1795219200,'BOOKED','synthetic privacy test')
  ON CONFLICT (id) DO NOTHING;
END;
$fixture$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',
  true
);
DO $anonymous$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.medical_appointments
  WHERE id='RC490-ANON-APPOINTMENT';
  IF n <> 0 THEN
    RAISE EXCEPTION 'RC490_ANONYMOUS_MEDICAL_APPOINTMENT_READ_SUCCEEDED:%',n;
  END IF;
END;
$anonymous$;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"49000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',
  true
);
DO $confirmed$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.medical_appointments
  WHERE id='RC490-ANON-APPOINTMENT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'RC490_CONFIRMED_MEDICAL_READ_REGRESSED:%',n;
  END IF;
END;
$confirmed$;
RESET ROLE;

ROLLBACK;
SELECT 'RC490 medical anonymous Auth read isolation: PASS' AS result;
