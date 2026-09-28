create table if not exists public.medical_appointments (
  id text primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  patient_id uuid not null,
  doctor_id text not null,
  date_time bigint not null,
  status varchar not null default 'BOOKED',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medical_appointments_patient_idx on public.medical_appointments(patient_id, date_time desc);
create index if not exists medical_appointments_business_idx on public.medical_appointments(tenant_id, business_id, date_time desc);
alter table public.medical_appointments enable row level security;
alter table public.medical_appointments force row level security;
drop policy if exists medical_appointments_customer_select on public.medical_appointments;
create policy medical_appointments_customer_select on public.medical_appointments for select to authenticated using ((select auth.uid()) = patient_id);
drop policy if exists medical_appointments_provider_select on public.medical_appointments;
create policy medical_appointments_provider_select on public.medical_appointments for select to authenticated using (exists (select 1 from public.user_memberships um where um.user_id=(select auth.uid()) and um.tenant_id=medical_appointments.tenant_id and um.status='ACTIVE' and upper(um.role) in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') and (um.business_id is null or um.business_id=medical_appointments.business_id)));
revoke insert, update, delete on public.medical_appointments from anon, authenticated;
create or replace function public.create_medical_appointment_backend(p_user_id uuid,p_appointment_id text,p_business_id uuid,p_doctor_id text,p_date_time bigint,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $fn$
declare v_tenant varchar;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'AUTH_USER_MISMATCH'; end if;
 if p_appointment_id is null or length(trim(p_appointment_id))<8 then raise exception 'INVALID_APPOINTMENT_ID'; end if;
 if p_business_id is null or p_doctor_id is null or p_date_time is null then raise exception 'INVALID_APPOINTMENT'; end if;
 select b.tenant_id into v_tenant from public.businesses b join public.marketing_provider_profiles mp on mp.business_id=b.id where b.id=p_business_id and mp.id::text=p_doctor_id and mp.status='ACTIVE' limit 1;
 if v_tenant is null then raise exception 'ACTIVE_MEDICAL_PROVIDER_NOT_FOUND'; end if;
 if not exists(select 1 from public.user_memberships um where um.user_id=p_user_id and um.tenant_id=v_tenant and um.status='ACTIVE') then raise exception 'ACTIVE_TENANT_MEMBERSHIP_REQUIRED'; end if;
 if exists(select 1 from public.medical_appointments where id=p_appointment_id) then raise exception 'APPOINTMENT_ID_ALREADY_EXISTS'; end if;
 if exists(select 1 from public.medical_appointments where doctor_id=p_doctor_id and date_time=p_date_time and status not in ('CANCELLED','COMPLETED')) then raise exception 'DOCTOR_SLOT_UNAVAILABLE'; end if;
 insert into public.medical_appointments(id,tenant_id,business_id,patient_id,doctor_id,date_time,status,reason) values(p_appointment_id,v_tenant,p_business_id,p_user_id,p_doctor_id,p_date_time,'BOOKED',nullif(trim(p_reason),''));
 return jsonb_build_object('id',p_appointment_id,'status','BOOKED');
end;$fn$;
revoke execute on function public.create_medical_appointment_backend(uuid,text,uuid,text,bigint,text) from public,anon,authenticated;
grant execute on function public.create_medical_appointment_backend(uuid,text,uuid,text,bigint,text) to authenticated;
create or replace function public.update_medical_appointment_status_backend(p_user_id uuid,p_appointment_id text,p_target_status text) returns jsonb language plpgsql security definer set search_path=public as $fn$
declare v_role text; v_uid uuid:=auth.uid(); v_old text;
begin
 if p_user_id is null or p_user_id<>v_uid then raise exception 'AUTH_USER_MISMATCH'; end if;
 select status into v_old from public.medical_appointments where id=p_appointment_id for update;
 if v_old is null then raise exception 'APPOINTMENT_NOT_FOUND'; end if;
 select upper(um.role) into v_role from public.user_memberships um join public.medical_appointments a on a.id=p_appointment_id where um.user_id=v_uid and um.tenant_id=a.tenant_id and um.status='ACTIVE' and (um.business_id is null or um.business_id=a.business_id) order by case when upper(um.role) in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') then 0 else 1 end limit 1;
 if v_role is null then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED'; end if;
 if p_target_status not in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW') then raise exception 'INVALID_MEDICAL_STATUS'; end if;
 if p_target_status='CANCELLED' and v_role not in ('SERVICE_PROVIDER','OWNER','BUSINESS_OWNER','ADMIN','MANAGER') and not exists(select 1 from public.medical_appointments where id=p_appointment_id and patient_id=v_uid) then raise exception 'NOT_ALLOWED'; end if;
 update public.medical_appointments set status=p_target_status,updated_at=now() where id=p_appointment_id;
 return jsonb_build_object('id',p_appointment_id,'old_status',v_old,'status',p_target_status);
end;$fn$;
revoke execute on function public.update_medical_appointment_status_backend(uuid,text,text) from public,anon,authenticated;
grant execute on function public.update_medical_appointment_status_backend(uuid,text,text) to authenticated;
