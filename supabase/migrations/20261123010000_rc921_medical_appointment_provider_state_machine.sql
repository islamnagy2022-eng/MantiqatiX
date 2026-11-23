-- RC921: bind provider status changes to the assigned provider and enforce a forward-only state machine.
-- Forward-only source migration. Apply only through the coordinated, approved Production release.
create or replace function public.update_medical_appointment_status_backend(
  p_user_id uuid,
  p_appointment_id text,
  p_target_status text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_appointment public.medical_appointments%rowtype;
  v_target text := upper(btrim(coalesce(p_target_status, '')));
  v_role text;
  v_is_patient boolean := false;
  v_is_assigned_provider boolean := false;
begin
  if v_uid is null or p_user_id is null or p_user_id <> v_uid then
    raise exception 'AUTH_USER_MISMATCH';
  end if;
  if p_appointment_id is null or btrim(p_appointment_id) = '' then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;
  if v_target not in ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW') then
    raise exception 'INVALID_MEDICAL_STATUS';
  end if;

  select a.*
    into v_appointment
  from public.medical_appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  -- Patient self-cancellation is independent of staff membership.
  v_is_patient := v_appointment.patient_id = v_uid;
  if v_is_patient then
    if v_target <> 'CANCELLED' then
      raise exception 'PATIENT_CANCELLATION_ONLY';
    end if;
    if v_appointment.status not in ('BOOKED', 'CONFIRMED') then
      raise exception 'INVALID_MEDICAL_STATUS_TRANSITION';
    end if;

    update public.medical_appointments
       set status = 'CANCELLED', updated_at = pg_catalog.now()
     where id = v_appointment.id;

    return pg_catalog.jsonb_build_object(
      'id', v_appointment.id,
      'old_status', v_appointment.status,
      'status', 'CANCELLED'
    );
  end if;

  -- Staff authority is scoped to the exact appointment tenant AND business.
  select upper(um.role)
    into v_role
  from public.user_memberships um
  where um.user_id = v_uid
    and um.tenant_id = v_appointment.tenant_id
    and um.business_id = v_appointment.business_id
    and um.status = 'ACTIVE'
    and upper(um.role) in ('SERVICE_PROVIDER', 'OWNER', 'BUSINESS_OWNER', 'ADMIN', 'MANAGER')
  order by case upper(um.role)
    when 'OWNER' then 1
    when 'BUSINESS_OWNER' then 2
    when 'ADMIN' then 3
    when 'MANAGER' then 4
    when 'SERVICE_PROVIDER' then 5
    else 6
  end
  limit 1;

  if v_role is null then
    raise exception 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED';
  end if;

  if v_role = 'SERVICE_PROVIDER' then
    select exists (
      select 1
      from public.marketing_provider_profiles mp
      join public.businesses b on b.id = mp.business_id
      where mp.id::text = v_appointment.doctor_id
        and mp.owner_user_id = v_uid
        and mp.business_id = v_appointment.business_id
        and b.tenant_id = v_appointment.tenant_id
        and upper(mp.status) = 'ACTIVE'
    ) into v_is_assigned_provider;

    if not v_is_assigned_provider then
      raise exception 'ASSIGNED_PROVIDER_REQUIRED';
    end if;
  end if;

  -- Explicit forward-only transition matrix. Terminal states never reopen.
  if v_appointment.status = 'BOOKED' then
    if v_target not in ('CONFIRMED', 'CANCELLED') then
      raise exception 'INVALID_MEDICAL_STATUS_TRANSITION';
    end if;
  elsif v_appointment.status = 'CONFIRMED' then
    if v_target not in ('COMPLETED', 'NO_SHOW', 'CANCELLED') then
      raise exception 'INVALID_MEDICAL_STATUS_TRANSITION';
    end if;
  else
    raise exception 'INVALID_MEDICAL_STATUS_TRANSITION';
  end if;

  update public.medical_appointments
     set status = v_target, updated_at = pg_catalog.now()
   where id = v_appointment.id;

  return pg_catalog.jsonb_build_object(
    'id', v_appointment.id,
    'old_status', v_appointment.status,
    'status', v_target
  );
end;
$function$;

revoke all on function public.update_medical_appointment_status_backend(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_medical_appointment_status_backend(uuid, text, text)
  to authenticated;
