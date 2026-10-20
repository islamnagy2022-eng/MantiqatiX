\set ON_ERROR_STOP on
create or replace function public.assert_medical_booking_rejected(
 p_user_id uuid,p_appointment_id text,p_business_id uuid,p_doctor_id text,p_date_time bigint,p_reason text,p_expected text
) returns void language plpgsql as $$
begin
 perform set_config('request.jwt.claim.sub',p_user_id::text,false);
 begin
  perform public.create_medical_appointment_backend(p_user_id,p_appointment_id,p_business_id,p_doctor_id,p_date_time,p_reason);
  raise exception 'RC462_EXPECTED_REJECTION_MISSING';
 exception when others then
  if sqlerrm='RC462_EXPECTED_REJECTION_MISSING' or position(p_expected in sqlerrm)=0 then raise; end if;
 end;
end $$;

do $$
declare
 patient constant uuid := '11111111-1111-4111-8111-111111111111';
 doctor constant text := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 business constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 slot bigint := (extract(epoch from now() + interval '2 days')*1000)::bigint;
 result jsonb;
begin
 perform set_config('request.jwt.claim.sub',patient::text,false);
 result := public.create_medical_appointment_backend(patient,'MED-RC462-VALID-0001',business,doctor,slot,'استشارة عامة');
 if result->>'status' <> 'BOOKED' or result->>'doctor_id' <> doctor then raise exception 'RC462_VALID_BOOKING_FAILED'; end if;
 perform public.assert_medical_booking_rejected(patient,'MED-RC462-PHARMACY-01',business,'ffffffff-ffff-4fff-8fff-ffffffffffff',slot+60000,'test','ACTIVE_VERIFIED_MEDICAL_PROVIDER_NOT_FOUND');
 perform public.assert_medical_booking_rejected(patient,'MED-RC462-UNVERIFIED-01',business,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',slot+120000,'test','ACTIVE_VERIFIED_MEDICAL_PROVIDER_NOT_FOUND');
 perform public.assert_medical_booking_rejected(patient,'MED-RC462-PAST-00001',business,doctor,1,'test','APPOINTMENT_TIME_MUST_BE_FUTURE');
 perform public.assert_medical_booking_rejected('33333333-3333-4333-8333-333333333333','MED-RC462-CROSS-TENANT',business,doctor,slot+180000,'test','ACTIVE_TENANT_MEMBERSHIP_REQUIRED');
 perform public.assert_medical_booking_rejected(patient,'MED-RC462-SLOT-RETRY',business,doctor,slot,'test','DOCTOR_SLOT_UNAVAILABLE');

 perform set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
 begin
  perform public.update_medical_appointment_status_backend('44444444-4444-4444-8444-444444444444','MED-RC462-VALID-0001','CONFIRMED');
  raise exception 'RC462_OTHER_DOCTOR_MUTATION_WAS_ALLOWED';
 exception when others then
  if sqlerrm='RC462_OTHER_DOCTOR_MUTATION_WAS_ALLOWED' or position('DOCTOR_PROFILE_OWNERSHIP_REQUIRED' in sqlerrm)=0 then raise; end if;
 end;
end $$;

select 'RC462_MEDICAL_BOOKING_RELEASE_CONTRACT_PASS' as result;
