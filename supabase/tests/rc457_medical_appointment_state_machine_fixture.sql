\set ON_ERROR_STOP on
create role authenticated nologin;
create role anon nologin;
create schema auth;
create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_memberships(
  user_id uuid not null, tenant_id varchar not null, business_id uuid,
  role varchar not null, status varchar not null default 'ACTIVE'
);
create table public.medical_appointments(
  id text primary key, tenant_id varchar not null, business_id uuid not null,
  patient_id uuid not null, doctor_id text not null, date_time bigint not null,
  status varchar not null default 'BOOKED', reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.user_memberships(user_id,tenant_id,business_id,role,status) values
 ('11111111-1111-4111-8111-111111111111','tenant-a',null,'CUSTOMER','ACTIVE'),
 ('22222222-2222-4222-8222-222222222222','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SERVICE_PROVIDER','ACTIVE'),
 ('33333333-3333-4333-8333-333333333333','tenant-b',null,'CUSTOMER','ACTIVE'),
 ('44444444-4444-4444-8444-444444444444','tenant-a',null,'CUSTOMER','ACTIVE');
insert into public.medical_appointments(id,tenant_id,business_id,patient_id,doctor_id,date_time,status) values
 ('appt-booked-provider','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',100,'BOOKED'),
 ('appt-confirmed-complete','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',200,'CONFIRMED'),
 ('appt-confirmed-noshow','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',300,'CONFIRMED'),
 ('appt-booked-customer-cancel','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',400,'BOOKED'),
 ('appt-confirmed-customer-cancel','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',500,'CONFIRMED'),
 ('appt-completed-terminal','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',600,'COMPLETED'),
 ('appt-cancelled-terminal','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',700,'CANCELLED'),
 ('appt-cross-tenant','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',800,'BOOKED'),
 ('appt-booked-invalid-complete','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',900,'BOOKED');
insert into public.medical_appointments(id,tenant_id,business_id,patient_id,doctor_id,date_time,status) values
 ('appt-future-noshow','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','provider-1',(extract(epoch from now() + interval '1 day') * 1000)::bigint,'CONFIRMED'),
 ('appt-cross-business','tenant-a','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','provider-2',850,'BOOKED');

create function public.update_medical_appointment_status_backend(p_user_id uuid,p_appointment_id text,p_target_status text) returns jsonb language sql as $$ select '{}'::jsonb $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant usage on schema public to authenticated, anon;
grant select on public.user_memberships, public.medical_appointments to authenticated;
revoke all on function public.update_medical_appointment_status_backend(uuid,text,text) from public, anon, authenticated;
grant execute on function public.update_medical_appointment_status_backend(uuid,text,text) to authenticated;
