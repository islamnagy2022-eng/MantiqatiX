-- Harden medical appointment status transitions.
-- Patients may cancel their own appointments; provider/admin roles control all other status changes.
create or replace function public.update_medical_appointment_status_backend(
  p_user_id uuid,
  p_appointment_id text,
  p_target_status text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_uid uuid := auth.uid();
  v_old text;
begin
  if p_user_id is null or p_user_id <> v_uid then raise exception 'AUTH_USER_MISMATCH'; end if;
  select status into v_old from public.medical_appointments where id=p_appointment_id for update;
  if v_old is null then raise exception 'APPOINTMENT_NOT_FOUND'; end if;

  select upper(um.role) into v_role
  from public.user_memberships um
  join public.medical_appointments a on a.id=p_appointment_id
  where um.user_id=v_uid
    and um.tenant_id=a.tenant_id
    and um.status='ACTIVE'
    and (um.business_id is null or um.business_id=a.business_id)
  order by case when upper(um.role) in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then 0 else 1 end
  limit 1;

  if v_role is null then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;
  if p_target_status not in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW') then raise exception 'INVALID_MEDICAL_STATUS'; end if;

  if p_target_status='CANCELLED' then
    if v_role not in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
       and not exists(select 1 from public.medical_appointments where id=p_appointment_id and patient_id=v_uid)
    then raise exception 'NOT_ALLOWED'; end if;
  elsif v_role not in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then
    raise exception 'PROVIDER_STATUS_CHANGE_REQUIRED';
  end if;

  update public.medical_appointments set status=p_target_status,updated_at=now() where id=p_appointment_id;
  return jsonb_build_object('id',p_appointment_id,'old_status',v_old,'status',p_target_status);
end;
$function$;
