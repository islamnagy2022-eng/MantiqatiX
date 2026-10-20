-- RC462: make doctor booking release-safe and bind provider mutations to the owning doctor.
-- Forward-only; preserves existing table shape and function EXECUTE grants.
create unique index if not exists uq_medical_appointment_active_doctor_slot
  on public.medical_appointments (doctor_id, date_time)
  where upper(status) not in ('CANCELLED','COMPLETED');

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
  if p_date_time <= (pg_catalog.extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint then
    raise exception 'APPOINTMENT_TIME_MUST_BE_FUTURE';
  end if;
  if pg_catalog.length(coalesce(v_reason,'')) > 500 then
    raise exception 'APPOINTMENT_REASON_TOO_LONG';
  end if;

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
  if exists (select 1 from public.medical_appointments a where a.id = p_appointment_id) then
    raise exception 'APPOINTMENT_ID_ALREADY_EXISTS';
  end if;
  if exists (
    select 1 from public.medical_appointments a
    where a.doctor_id = p_doctor_id
      and a.date_time = p_date_time
      and pg_catalog.upper(a.status) not in ('CANCELLED','COMPLETED')
  ) then
    raise exception 'DOCTOR_SLOT_UNAVAILABLE';
  end if;

  insert into public.medical_appointments(
    id, tenant_id, business_id, patient_id, doctor_id, date_time, status, reason
  ) values (
    pg_catalog.btrim(p_appointment_id), v_tenant_id, p_business_id, p_user_id,
    p_doctor_id, p_date_time, 'BOOKED', v_reason
  );

  return pg_catalog.jsonb_build_object(
    'id', p_appointment_id, 'status', 'BOOKED', 'business_id', p_business_id,
    'doctor_id', p_doctor_id, 'date_time', p_date_time
  );
end;
$function$;

create or replace function public.update_medical_appointment_status_backend(
  p_user_id uuid,
  p_appointment_id text,
  p_target_status text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_old text;
  v_patient_id uuid;
  v_tenant_id varchar;
  v_business_id uuid;
  v_doctor_id text;
  v_date_time bigint;
  v_profile_owner_id uuid;
  v_target text := pg_catalog.upper(nullif(pg_catalog.btrim(p_target_status), ''));
  v_provider_role boolean := false;
  v_allowed boolean := false;
begin
  if p_user_id is null or v_uid is null or p_user_id is distinct from v_uid then
    raise exception 'AUTH_USER_MISMATCH';
  end if;
  if v_target is null or v_target not in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW') then
    raise exception 'INVALID_MEDICAL_STATUS';
  end if;

  select a.status, a.patient_id, a.tenant_id, a.business_id, a.date_time, a.doctor_id
    into v_old, v_patient_id, v_tenant_id, v_business_id, v_date_time, v_doctor_id
  from public.medical_appointments a
  where a.id = p_appointment_id
  for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND'; end if;

  select pg_catalog.upper(um.role) into v_role
  from public.user_memberships um
  where um.user_id = v_uid
    and um.tenant_id = v_tenant_id
    and um.status = 'ACTIVE'
    and (um.business_id is null or um.business_id = v_business_id)
  order by case
    when pg_catalog.upper(um.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then 0
    when pg_catalog.upper(um.role) = 'SERVICE_PROVIDER' then 1
    else 2
  end
  limit 1;
  if v_role is null then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;

  v_provider_role := v_role in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER');
  if v_role = 'SERVICE_PROVIDER' then
    select mp.owner_user_id into v_profile_owner_id
    from public.marketing_provider_profiles mp
    where mp.id::text = v_doctor_id
      and mp.business_id = v_business_id
      and pg_catalog.upper(coalesce(mp.status,'')) = 'ACTIVE';
    if v_profile_owner_id is distinct from v_uid then
      raise exception 'DOCTOR_PROFILE_OWNERSHIP_REQUIRED';
    end if;
  end if;

  if v_target = 'CANCELLED' then
    if pg_catalog.upper(v_old) not in ('BOOKED','CONFIRMED') then
      raise exception 'MEDICAL_APPOINTMENT_NOT_CANCELLABLE';
    end if;
    v_allowed := v_provider_role or v_patient_id = v_uid;
    if not v_allowed then raise exception 'NOT_ALLOWED'; end if;
  else
    if not v_provider_role then raise exception 'PROVIDER_STATUS_CHANGE_REQUIRED'; end if;
    v_allowed := (pg_catalog.upper(v_old) = 'BOOKED' and v_target = 'CONFIRMED')
      or (pg_catalog.upper(v_old) = 'CONFIRMED' and v_target in ('COMPLETED','NO_SHOW'));
    if not v_allowed then raise exception 'INVALID_MEDICAL_STATUS_TRANSITION'; end if;
  end if;

  if v_target = 'NO_SHOW' and v_date_time > (pg_catalog.extract(epoch from pg_catalog.now()) * 1000)::bigint then
    raise exception 'MEDICAL_APPOINTMENT_NOT_DUE';
  end if;

  update public.medical_appointments
  set status = v_target, updated_at = pg_catalog.now()
  where id = p_appointment_id;
  return pg_catalog.jsonb_build_object('id', p_appointment_id, 'old_status', v_old, 'status', v_target);
end;
$function$;
