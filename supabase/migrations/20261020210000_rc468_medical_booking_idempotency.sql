-- RC468: make doctor booking retries idempotent when the same request ID and payload are replayed.
-- Forward-only; preserves the existing table shape and RPC grants.
create or replace function public.create_medical_appointment_backend(
  p_user_id uuid,
  p_appointment_id text,
  p_business_id uuid,
  p_doctor_id text,
  p_date_time bigint,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id varchar;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason,'')), '');
  v_existing_patient uuid;
  v_existing_business uuid;
  v_existing_doctor text;
  v_existing_time bigint;
  v_existing_reason text;
  v_existing_status text;
  v_inserted_id text;
begin
  if p_user_id is null or auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'AUTH_USER_MISMATCH';
  end if;
  if p_appointment_id is null or pg_catalog.length(pg_catalog.btrim(p_appointment_id)) not between 8 and 100 then
    raise exception 'INVALID_APPOINTMENT_ID';
  end if;
  if p_business_id is null or p_doctor_id is null or pg_catalog.btrim(p_doctor_id) = '' or p_date_time is null then
    raise exception 'INVALID_APPOINTMENT';
  end if;
  if p_date_time <= (extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint then
    raise exception 'APPOINTMENT_TIME_MUST_BE_FUTURE';
  end if;
  if p_date_time % 900000 <> 0 then
    raise exception 'APPOINTMENT_SLOT_ALIGNMENT_REQUIRED';
  end if;
  if pg_catalog.length(coalesce(v_reason,'')) > 500 then
    raise exception 'APPOINTMENT_REASON_TOO_LONG';
  end if;

  -- Serialize all retries for the same request ID, even if a malicious retry
  -- changes the doctor/business fields and therefore the doctor lock key.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('medical-booking-id:' || pg_catalog.btrim(p_appointment_id), 0)
  );

  select b.tenant_id into v_tenant_id
  from public.businesses b
  join public.marketing_provider_profiles mp on mp.business_id = b.id
  where b.id = p_business_id
    and pg_catalog.upper(coalesce(b.status,'')) = 'ACTIVE'
    and mp.id::text = p_doctor_id
    and pg_catalog.upper(coalesce(mp.status,'')) = 'ACTIVE'
    and mp.is_verified is true
    and pg_catalog.upper(coalesce(mp.provider_kind,'')) in ('HEALTH','DENTAL','MEDICAL','VETERINARY')
  limit 1;

  if v_tenant_id is null then
    raise exception 'ACTIVE_VERIFIED_MEDICAL_PROVIDER_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.user_memberships um
    where um.user_id = p_user_id and um.tenant_id = v_tenant_id and um.status = 'ACTIVE'
  ) then
    raise exception 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED';
  end if;

  -- A replay of the same request returns the existing booking; a reused ID with a
  -- different actor or payload is rejected and never mutates the existing record.
  select a.patient_id, a.business_id, a.doctor_id, a.date_time, a.reason, a.status
    into v_existing_patient, v_existing_business, v_existing_doctor, v_existing_time, v_existing_reason, v_existing_status
  from public.medical_appointments a
  where a.id = pg_catalog.btrim(p_appointment_id)
  for update;
  if found then
    if v_existing_patient is distinct from p_user_id
       or v_existing_business is distinct from p_business_id
       or v_existing_doctor is distinct from p_doctor_id
       or v_existing_time is distinct from p_date_time
       or nullif(pg_catalog.btrim(coalesce(v_existing_reason,'')), '') is distinct from v_reason then
      raise exception 'APPOINTMENT_ID_ALREADY_EXISTS';
    end if;
    return pg_catalog.jsonb_build_object(
      'id', pg_catalog.btrim(p_appointment_id), 'status', v_existing_status,
      'business_id', p_business_id, 'doctor_id', p_doctor_id,
      'date_time', p_date_time, 'idempotent_replay', true
    );
  end if;

  -- Serialize bookings for this doctor, then reject overlapping 30-minute visits.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_doctor_id, 0));
  if exists (
    select 1 from public.medical_appointments a
    where a.doctor_id = p_doctor_id
      and a.date_time > p_date_time - 1800000
      and a.date_time < p_date_time + 1800000
      and pg_catalog.upper(a.status) not in ('CANCELLED','COMPLETED')
  ) then
    raise exception 'DOCTOR_SLOT_UNAVAILABLE';
  end if;

  insert into public.medical_appointments(
    id, tenant_id, business_id, patient_id, doctor_id, date_time, status, reason
  ) values (
    pg_catalog.btrim(p_appointment_id), v_tenant_id, p_business_id, p_user_id,
    p_doctor_id, p_date_time, 'BOOKED', v_reason
  )
  on conflict (id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    -- Another identical request may have inserted the ID after the initial read.
    -- Resolve that race by re-reading and applying the same strict payload check.
    select a.patient_id, a.business_id, a.doctor_id, a.date_time, a.reason, a.status
      into v_existing_patient, v_existing_business, v_existing_doctor, v_existing_time,
           v_existing_reason, v_existing_status
    from public.medical_appointments a
    where a.id = pg_catalog.btrim(p_appointment_id)
    for update;

    if not found
       or v_existing_patient is distinct from p_user_id
       or v_existing_business is distinct from p_business_id
       or v_existing_doctor is distinct from p_doctor_id
       or v_existing_time is distinct from p_date_time
       or nullif(pg_catalog.btrim(coalesce(v_existing_reason,'')), '') is distinct from v_reason then
      raise exception 'APPOINTMENT_ID_ALREADY_EXISTS';
    end if;

    return pg_catalog.jsonb_build_object(
      'id', pg_catalog.btrim(p_appointment_id), 'status', v_existing_status,
      'business_id', p_business_id, 'doctor_id', p_doctor_id,
      'date_time', p_date_time, 'idempotent_replay', true
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'id', v_inserted_id, 'status', 'BOOKED', 'business_id', p_business_id,
    'doctor_id', p_doctor_id, 'date_time', p_date_time, 'idempotent_replay', false
  );
end;
$function$;
