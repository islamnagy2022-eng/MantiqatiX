-- DEMO-only clinic booking guard. Never apply to LIVE.
-- The connected DEMO can book appointments only for a DEMO business explicitly
-- tagged as the Doctors/Clinics sector. Use an empty search_path for the definer.
CREATE OR REPLACE FUNCTION public.create_medical_appointment_backend(p_user_id uuid, p_appointment_id text, p_business_id uuid, p_doctor_id text, p_date_time bigint, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tenant varchar;
  v_status text;
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'AUTH_USER_MISMATCH';
  end if;
  if p_appointment_id is null or length(trim(p_appointment_id)) < 8 then
    raise exception 'INVALID_APPOINTMENT_ID';
  end if;
  if p_business_id is null or p_doctor_id is null or p_date_time is null then
    raise exception 'INVALID_APPOINTMENT';
  end if;
  select b.tenant_id into v_tenant
  from public.businesses b
  join public.marketing_provider_profiles mp on mp.business_id=b.id
  where b.id=p_business_id and mp.id::text=p_doctor_id and mp.status='ACTIVE'
    and coalesce(b.settings->>'environment','')='DEMO'
    and coalesce(b.settings->>'sector_code','')='DOCTOR'
    and coalesce(mp.settings->>'environment','')='DEMO'
    and coalesce(mp.settings->>'sector_code','')='DOCTOR'
  limit 1;
  if v_tenant is null then raise exception 'ACTIVE_MEDICAL_PROVIDER_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.user_memberships um
    where um.user_id=p_user_id and um.tenant_id=v_tenant and um.status='ACTIVE'
  ) then raise exception 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED'; end if;
  if exists (select 1 from public.medical_appointments where id=p_appointment_id) then
    raise exception 'APPOINTMENT_ID_ALREADY_EXISTS';
  end if;
  if exists (
    select 1 from public.medical_appointments
    where doctor_id=p_doctor_id and date_time=p_date_time and status not in ('CANCELLED','COMPLETED')
  ) then
    raise exception 'DOCTOR_SLOT_UNAVAILABLE';
  end if;
  insert into public.medical_appointments(id,tenant_id,business_id,patient_id,doctor_id,date_time,status,reason)
  values(p_appointment_id,v_tenant,p_business_id,p_user_id,p_doctor_id,p_date_time,'BOOKED',nullif(trim(p_reason),''));
  return jsonb_build_object('id',p_appointment_id,'status','BOOKED');
end;
$function$;

revoke all on function public.create_medical_appointment_backend(uuid, text, uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_medical_appointment_backend(uuid, text, uuid, text, bigint, text)
  to authenticated, service_role;
