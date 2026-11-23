-- RC921 adversarial behavior tests. Run only in disposable PostgreSQL after fixture + migration.
set role authenticated;
do $test$
declare
  rejected boolean;
  payload jsonb;
  provider_a constant uuid := 'c0000000-0000-4000-8000-000000000001';
  provider_b constant uuid := 'c0000000-0000-4000-8000-000000000002';
  patient constant uuid := 'd0000000-0000-4000-8000-000000000003';
  manager_other_business constant uuid := 'c0000000-0000-4000-8000-000000000003';
  admin_other_tenant constant uuid := 'c0000000-0000-4000-8000-000000000004';
begin
  perform set_config('request.jwt.claim.sub',provider_b::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(provider_b,'RC921-PROVIDER-A','CONFIRMED');
  exception when others then
    if sqlerrm = 'ASSIGNED_PROVIDER_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'provider B changed provider A appointment'; end if;

  perform set_config('request.jwt.claim.sub',provider_a::text,false);
  payload := public.update_medical_appointment_status_backend(provider_a,'RC921-PROVIDER-A','CONFIRMED');
  if payload->>'status' <> 'CONFIRMED' then raise exception 'assigned provider confirmation failed'; end if;

  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(provider_a,'RC921-PROVIDER-A','BOOKED');
  exception when others then
    if sqlerrm = 'INVALID_MEDICAL_STATUS' or sqlerrm = 'INVALID_MEDICAL_STATUS_TRANSITION' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'invalid provider transition was accepted'; end if;

  perform public.update_medical_appointment_status_backend(provider_a,'RC921-PROVIDER-A','COMPLETED');
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(provider_a,'RC921-PROVIDER-A','CANCELLED');
  exception when others then
    if sqlerrm = 'INVALID_MEDICAL_STATUS_TRANSITION' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'terminal appointment was reopened/changed'; end if;

  perform set_config('request.jwt.claim.sub',manager_other_business::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(manager_other_business,'RC921-CROSS-BIZ','CONFIRMED');
  exception when others then
    if sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-business manager changed appointment'; end if;

  perform set_config('request.jwt.claim.sub',admin_other_tenant::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(admin_other_tenant,'RC921-CROSS-TENANT','CONFIRMED');
  exception when others then
    if sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'cross-tenant admin changed appointment'; end if;

  -- Patient has no staff membership in the fixture; own cancellation must still work.
  perform set_config('request.jwt.claim.sub',patient::text,false);
  payload := public.update_medical_appointment_status_backend(patient,'RC921-PATIENT','CANCELLED');
  if payload->>'status' <> 'CANCELLED' then raise exception 'patient own cancellation failed'; end if;

  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(patient,'RC921-PROVIDER-B','CANCELLED');
  exception when others then
    if sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'patient cancelled another patient appointment'; end if;

  perform set_config('request.jwt.claim.sub',provider_a::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(provider_a,'RC921-TERMINAL','CANCELLED');
  exception when others then
    if sqlerrm = 'ASSIGNED_PROVIDER_REQUIRED' or sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'provider changed terminal appointment'; end if;
end;
$test$;
reset role;
select 'RC921 provider ownership, business scope, patient cancellation and transition matrix: PASS' as result;
