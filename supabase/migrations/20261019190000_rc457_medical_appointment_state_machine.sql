-- RC457: enforce the medical appointment state machine server-side.
-- Forward-only. No table, data, or grant changes.
-- UI-supported transitions: BOOKED -> CONFIRMED/CANCELLED;
-- CONFIRMED -> COMPLETED/NO_SHOW/CANCELLED. Cancellation is allowed for
-- the owning patient or an authorized provider/manager only while active.
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
  v_date_time bigint;
  v_target text := upper(nullif(trim(p_target_status), ''));
  v_provider_role boolean := false;
  v_allowed boolean := false;
begin
  if p_user_id is null or v_uid is null or p_user_id is distinct from v_uid then
    raise exception 'AUTH_USER_MISMATCH';
  end if;

  if v_target is null or v_target not in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW') then
    raise exception 'INVALID_MEDICAL_STATUS';
  end if;

  select a.status, a.patient_id, a.tenant_id, a.business_id, a.date_time
    into v_old, v_patient_id, v_tenant_id, v_business_id, v_date_time
  from public.medical_appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception 'APPOINTMENT_NOT_FOUND';
  end if;

  select upper(um.role) into v_role
  from public.user_memberships um
  where um.user_id = v_uid
    and um.tenant_id = v_tenant_id
    and um.status = 'ACTIVE'
    and (um.business_id is null or um.business_id = v_business_id)
  order by case
    when upper(um.role) in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then 0
    else 1
  end
  limit 1;

  if v_role is null then
    raise exception 'ACTIVE_MEMBERSHIP_REQUIRED';
  end if;

  v_provider_role := v_role in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER');

  if v_target = 'CANCELLED' then
    if upper(v_old) not in ('BOOKED','CONFIRMED') then
      raise exception 'MEDICAL_APPOINTMENT_NOT_CANCELLABLE';
    end if;
    v_allowed := v_provider_role or v_patient_id = v_uid;
    if not v_allowed then
      raise exception 'NOT_ALLOWED';
    end if;
  else
    if not v_provider_role then
      raise exception 'PROVIDER_STATUS_CHANGE_REQUIRED';
    end if;
    v_allowed := (upper(v_old) = 'BOOKED' and v_target = 'CONFIRMED')
      or (upper(v_old) = 'CONFIRMED' and v_target in ('COMPLETED','NO_SHOW'));
    if not v_allowed then
      raise exception 'INVALID_MEDICAL_STATUS_TRANSITION';
    end if;
  end if;

  if v_target = 'NO_SHOW' and v_date_time > (extract(epoch from now()) * 1000)::bigint then
    raise exception 'MEDICAL_APPOINTMENT_NOT_DUE';
  end if;

  update public.medical_appointments
  set status = v_target, updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object('id', p_appointment_id, 'old_status', v_old, 'status', v_target);
end;
$function$;
