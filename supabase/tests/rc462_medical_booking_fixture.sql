\set ON_ERROR_STOP on
create table public.businesses(id uuid primary key,tenant_id varchar not null,status varchar not null);
create table public.marketing_provider_profiles(
 id uuid primary key,provider_kind varchar not null,business_id uuid not null,
 owner_user_id uuid not null,status varchar not null,is_verified boolean not null,name_ar varchar
);
insert into public.businesses(id,tenant_id,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','tenant-a','ACTIVE'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','tenant-a','ACTIVE');
insert into public.marketing_provider_profiles(id,provider_kind,business_id,owner_user_id,status,is_verified,name_ar) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','HEALTH','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','ACTIVE',true,'عيادة اختبار'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','HEALTH','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','ACTIVE',true,'طبيب آخر'),
 ('ffffffff-ffff-4fff-8fff-ffffffffffff','PHARMACY','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','ACTIVE',true,'صيدلية اختبار'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','HEALTH','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','ACTIVE',true,'عيادة مؤسسة أخرى'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','HEALTH','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','ACTIVE',false,'طبيب غير موثق');
insert into public.user_memberships(user_id,tenant_id,business_id,role,status) values
 ('44444444-4444-4444-8444-444444444444','tenant-a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SERVICE_PROVIDER','ACTIVE');
update public.medical_appointments set doctor_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd' where doctor_id='provider-1';
update public.medical_appointments set doctor_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' where doctor_id='provider-2';

alter table public.medical_appointments enable row level security;
drop policy if exists medical_appointments_customer_select on public.medical_appointments;
create policy medical_appointments_customer_select on public.medical_appointments
for select to authenticated using ((select auth.uid()) = patient_id);
grant select on public.medical_appointments, public.marketing_provider_profiles, public.businesses to authenticated;
