\set ON_ERROR_STOP on
-- Run after RC462 fixture/integration and RC467/RC468 migrations.
do $$
declare
  patient constant uuid := '11111111-1111-4111-8111-111111111111';
  appointment_id constant text := 'MED-RC467-VALID-0001';
  existing public.medical_appointments%rowtype;
  replay jsonb;
  before_count integer;
  after_count integer;
begin
  perform set_config('request.jwt.claim.sub', patient::text, false);
  select * into strict existing
  from public.medical_appointments
  where id = appointment_id and patient_id = patient;

  select count(*) into before_count from public.medical_appointments where id = appointment_id;

  -- Simulate a lost client response that is retried after the appointment time has passed.
  -- Keep the stored request payload identical; only the existing row's time is moved into the past.
  existing.date_time := (pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000 / 900000)::bigint - 1) * 900000;
  update public.medical_appointments set date_time = existing.date_time where id = appointment_id;

  -- A successful booking must remain replayable if the provider is disabled
  -- before the client receives the original success response.
  update public.marketing_provider_profiles set status = 'INACTIVE'
  where id::text = existing.doctor_id;
  replay := public.create_medical_appointment_backend(
    patient, appointment_id, existing.business_id, existing.doctor_id,
    existing.date_time, existing.reason
  );
  if replay->>'idempotent_replay' <> 'true'
     or replay->>'id' <> appointment_id
     or replay->>'status' <> existing.status then
    raise exception 'RC468_EXACT_REPLAY_RESULT_MISMATCH';
  end if;
  update public.marketing_provider_profiles set status = 'ACTIVE'
  where id::text = existing.doctor_id;
  select count(*) into after_count from public.medical_appointments where id = appointment_id;
  if after_count <> before_count then raise exception 'RC468_REPLAY_CREATED_DUPLICATE'; end if;

  -- The same past timestamp must still be rejected for a genuinely new request.
  begin
    perform public.create_medical_appointment_backend(
      patient, 'MED-RC468-PAST-NEW-0001', existing.business_id,
      existing.doctor_id, existing.date_time, 'new request must be rejected'
    );
    raise exception 'RC468_NEW_PAST_BOOKING_WAS_ALLOWED';
  exception when others then
    if sqlerrm = 'RC468_NEW_PAST_BOOKING_WAS_ALLOWED'
       or position('APPOINTMENT_TIME_MUST_BE_FUTURE' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.create_medical_appointment_backend(
      patient, appointment_id, existing.business_id, existing.doctor_id,
      existing.date_time, coalesce(existing.reason,'') || ' altered'
    );
    raise exception 'RC468_PAYLOAD_MISMATCH_WAS_ALLOWED';
  exception when others then
    if sqlerrm = 'RC468_PAYLOAD_MISMATCH_WAS_ALLOWED'
       or position('APPOINTMENT_ID_ALREADY_EXISTS' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.create_medical_appointment_backend(
      '33333333-3333-4333-8333-333333333333', appointment_id,
      existing.business_id, existing.doctor_id, existing.date_time, existing.reason
    );
    raise exception 'RC468_CROSS_PATIENT_REPLAY_WAS_ALLOWED';
  exception when others then
    if sqlerrm = 'RC468_CROSS_PATIENT_REPLAY_WAS_ALLOWED'
       or position('AUTH_USER_MISMATCH' in sqlerrm) = 0 then raise; end if;
  end;

  select count(*) into after_count from public.medical_appointments where id = appointment_id;
  if after_count <> before_count then raise exception 'RC468_REPLAY_MUTATED_APPOINTMENT_COUNT'; end if;
end $$;
select 'RC468 medical booking idempotency integration: PASS' as result;
