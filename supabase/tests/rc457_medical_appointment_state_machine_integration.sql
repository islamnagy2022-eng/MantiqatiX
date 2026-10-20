\set ON_ERROR_STOP on
create function public.assert_medical_rejected(
  p_uid uuid, p_appointment_id text, p_target text, p_expected_error text
) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, false);
  begin
    perform public.update_medical_appointment_status_backend(p_uid,p_appointment_id,p_target);
    raise exception 'RC457_EXPECTED_REJECTION_MISSING';
  exception when others then
    if sqlerrm = 'RC457_EXPECTED_REJECTION_MISSING' then raise; end if;
    if position(p_expected_error in sqlerrm) = 0 then
      raise exception 'RC457_WRONG_REJECTION: expected %, got %',p_expected_error,sqlerrm;
    end if;
  end;
end;
$$;
grant execute on function public.assert_medical_rejected(uuid,text,text,text) to authenticated;

set role authenticated;

-- Valid provider transitions.
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.update_medical_appointment_status_backend(
 '22222222-2222-4222-8222-222222222222','appt-booked-provider','CONFIRMED');
select public.update_medical_appointment_status_backend(
 '22222222-2222-4222-8222-222222222222','appt-confirmed-complete','COMPLETED');
select public.update_medical_appointment_status_backend(
 '22222222-2222-4222-8222-222222222222','appt-confirmed-noshow','NO_SHOW');

-- The owning patient may cancel only an active appointment.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.update_medical_appointment_status_backend(
 '11111111-1111-4111-8111-111111111111','appt-booked-customer-cancel','CANCELLED');
select public.update_medical_appointment_status_backend(
 '11111111-1111-4111-8111-111111111111','appt-confirmed-customer-cancel','CANCELLED');

-- Forbidden transitions, terminal-state rewrites, and tenant/identity violations.
select public.assert_medical_rejected(
 '11111111-1111-4111-8111-111111111111','appt-completed-terminal','CANCELLED','MEDICAL_APPOINTMENT_NOT_CANCELLABLE');
select public.assert_medical_rejected(
 '11111111-1111-4111-8111-111111111111','appt-cancelled-terminal','CANCELLED','MEDICAL_APPOINTMENT_NOT_CANCELLABLE');
select public.assert_medical_rejected(
 '22222222-2222-4222-8222-222222222222','appt-completed-terminal','CONFIRMED','INVALID_MEDICAL_STATUS_TRANSITION');
select public.assert_medical_rejected(
 '11111111-1111-4111-8111-111111111111','appt-confirmed-complete','COMPLETED','PROVIDER_STATUS_CHANGE_REQUIRED');
select public.assert_medical_rejected(
 '22222222-2222-4222-8222-222222222222','appt-booked-invalid-complete','COMPLETED','INVALID_MEDICAL_STATUS_TRANSITION');
select public.assert_medical_rejected(
 '22222222-2222-4222-8222-222222222222','appt-future-noshow','NO_SHOW','MEDICAL_APPOINTMENT_NOT_DUE');
select public.assert_medical_rejected(
 '33333333-3333-4333-8333-333333333333','appt-cross-tenant','CANCELLED','ACTIVE_MEMBERSHIP_REQUIRED');
select public.assert_medical_rejected(
 '44444444-4444-4444-8444-444444444444','appt-booked-invalid-complete','CANCELLED','NOT_ALLOWED');
select public.assert_medical_rejected(
 '22222222-2222-4222-8222-222222222222','appt-booked-provider','INVALID','INVALID_MEDICAL_STATUS');

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
begin
  begin
    perform public.update_medical_appointment_status_backend(
      '22222222-2222-4222-8222-222222222222','appt-booked-provider','CONFIRMED');
    raise exception 'RC457_EXPECTED_IDENTITY_MISMATCH_MISSING';
  exception when others then
    if sqlerrm = 'RC457_EXPECTED_IDENTITY_MISMATCH_MISSING' then raise; end if;
    if position('AUTH_USER_MISMATCH' in sqlerrm)=0 then
      raise exception 'RC457_WRONG_IDENTITY_ERROR: %',sqlerrm;
    end if;
  end;
end $$;

-- Assert final rows and function execute boundary.
do $$
begin
  if (select status from public.medical_appointments where id='appt-booked-provider') <> 'CONFIRMED' then raise exception 'RC457_ASSERT_PROVIDER_CONFIRM'; end if;
  if (select status from public.medical_appointments where id='appt-confirmed-complete') <> 'COMPLETED' then raise exception 'RC457_ASSERT_COMPLETED'; end if;
  if (select status from public.medical_appointments where id='appt-confirmed-noshow') <> 'NO_SHOW' then raise exception 'RC457_ASSERT_NO_SHOW'; end if;
  if (select status from public.medical_appointments where id='appt-future-noshow') <> 'CONFIRMED' then raise exception 'RC457_ASSERT_FUTURE_NO_SHOW_REJECTED'; end if;
  if (select status from public.medical_appointments where id='appt-booked-customer-cancel') <> 'CANCELLED' then raise exception 'RC457_ASSERT_PATIENT_CANCEL_BOOKED'; end if;
  if (select status from public.medical_appointments where id='appt-confirmed-customer-cancel') <> 'CANCELLED' then raise exception 'RC457_ASSERT_PATIENT_CANCEL_CONFIRMED'; end if;
  if has_function_privilege('anon','public.update_medical_appointment_status_backend(uuid,text,text)','EXECUTE') then raise exception 'RC457_ANON_EXECUTE_MUST_BE_DENIED'; end if;
  if not has_function_privilege('authenticated','public.update_medical_appointment_status_backend(uuid,text,text)','EXECUTE') then raise exception 'RC457_AUTHENTICATED_EXECUTE_REQUIRED'; end if;
end $$;

reset role;
drop function public.assert_medical_rejected(uuid,text,text,text);
select 'RC457 medical appointment state-machine integration: PASS' as result;
