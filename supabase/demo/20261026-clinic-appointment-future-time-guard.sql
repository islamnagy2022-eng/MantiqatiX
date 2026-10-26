-- DEMO-only server-side appointment time validation.
-- Apply ONLY to MantiqatiX-DEMO; never apply this file to LIVE without its own
-- migration review and approval. The browser/Edge validation is not a substitute
-- for enforcing the same invariant inside the SECURITY DEFINER database function.
CREATE OR REPLACE FUNCTION public.create_medical_appointment_backend(
  p_user_id uuid,
  p_appointment_id text,
  p_business_id uuid,
  p_doctor_id text,
  p_date_time bigint,
  p_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tenant varchar;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'AUTH_USER_MISMATCH';
  END IF;

  IF p_appointment_id IS NULL OR length(trim(p_appointment_id)) < 8 THEN
    RAISE EXCEPTION 'INVALID_APPOINTMENT_ID';
  END IF;

  IF p_business_id IS NULL OR p_doctor_id IS NULL OR p_date_time IS NULL THEN
    RAISE EXCEPTION 'INVALID_APPOINTMENT';
  END IF;

  -- date_time is Unix epoch milliseconds. Enforce this at the database layer
  -- because the authenticated role can call this RPC without going through
  -- demo-appointment-create, whose own validation is not a security boundary.
  IF p_date_time <= (extract(epoch FROM pg_catalog.clock_timestamp()) * 1000)::bigint THEN
    RAISE EXCEPTION 'APPOINTMENT_TIME_MUST_BE_FUTURE';
  END IF;

  SELECT b.tenant_id INTO v_tenant
  FROM public.businesses b
  JOIN public.marketing_provider_profiles mp ON mp.business_id = b.id
  WHERE b.id = p_business_id
    AND mp.id::text = p_doctor_id
    AND mp.status = 'ACTIVE'
    AND coalesce(b.settings->>'environment', '') = 'DEMO'
    AND coalesce(b.settings->>'sector_code', '') = 'DOCTOR'
    AND coalesce(mp.settings->>'environment', '') = 'DEMO'
    AND coalesce(mp.settings->>'sector_code', '') = 'DOCTOR'
  LIMIT 1;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_MEDICAL_PROVIDER_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_memberships um
    WHERE um.user_id = p_user_id
      AND um.tenant_id = v_tenant
      AND um.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.medical_appointments
    WHERE id = p_appointment_id
  ) THEN
    RAISE EXCEPTION 'APPOINTMENT_ID_ALREADY_EXISTS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.medical_appointments
    WHERE doctor_id = p_doctor_id
      AND date_time = p_date_time
      AND status NOT IN ('CANCELLED', 'COMPLETED')
  ) THEN
    RAISE EXCEPTION 'DOCTOR_SLOT_UNAVAILABLE';
  END IF;

  INSERT INTO public.medical_appointments
    (id, tenant_id, business_id, patient_id, doctor_id, date_time, status, reason)
  VALUES
    (p_appointment_id, v_tenant, p_business_id, p_user_id, p_doctor_id,
     p_date_time, 'BOOKED', nullif(trim(p_reason), ''));

  RETURN jsonb_build_object('id', p_appointment_id, 'status', 'BOOKED');
END;
$function$;
