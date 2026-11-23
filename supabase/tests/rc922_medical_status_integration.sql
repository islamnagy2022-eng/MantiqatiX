-- RC922 adversarial regression tests. Run only in disposable PostgreSQL 17.
set role authenticated;
do $test$
declare
  rejected boolean;
  payload jsonb;
  tenant_wide_provider constant uuid := 'c0000000-0000-4000-8000-000000000005';
  tenant_wide_manager constant uuid := 'c0000000-0000-4000-8000-000000000006';
  tenant_wide_admin constant uuid := 'c0000000-0000-4000-8000-000000000007';
  tenant_wide_owner constant uuid := 'c0000000-0000-4000-8000-000000000008';
begin
  -- Positive case: a tenant-wide SERVICE_PROVIDER can change the appointment
  -- only because doctor_id points to an ACTIVE profile owned by this user and
  -- attached to the exact appointment business inside the same tenant.
  perform set_config('request.jwt.claim.sub',tenant_wide_provider::text,false);
  payload := public.update_medical_appointment_status_backend(
    tenant_wide_provider,'RC922-TENANT-WIDE-PROVIDER','CONFIRMED'
  );
  if payload->>'status' <> 'CONFIRMED' then
    raise exception 'RC922_TENANT_WIDE_PROVIDER_ASSIGNED_PROFILE_DID_NOT_CONFIRM';
  end if;

  -- It cannot use its tenant-wide membership to mutate a different business'
  -- appointment when the referenced doctor profile is owned by someone else.
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(
      tenant_wide_provider,'RC922-TENANT-WIDE-CROSS-BIZ','CONFIRMED'
    );
  exception when others then
    if sqlerrm = 'ASSIGNED_PROVIDER_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then
    raise exception 'RC922_TENANT_WIDE_PROVIDER_CHANGED_UNOWNED_CROSS_BUSINESS_PROFILE';
  end if;

  -- The NULL-business exception must never grant tenant-wide manager rights.
  perform set_config('request.jwt.claim.sub',tenant_wide_manager::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(
      tenant_wide_manager,'RC922-TENANT-WIDE-PROVIDER','CANCELLED'
    );
  exception when others then
    if sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'RC922_TENANT_WIDE_MANAGER_RECEIVED_PROVIDER_EXCEPTION'; end if;

  -- Nor may tenant-wide ADMIN obtain this exception.
  perform set_config('request.jwt.claim.sub',tenant_wide_admin::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(
      tenant_wide_admin,'RC922-TENANT-WIDE-PROVIDER','CANCELLED'
    );
  exception when others then
    if sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'RC922_TENANT_WIDE_ADMIN_RECEIVED_PROVIDER_EXCEPTION'; end if;

  -- Nor may tenant-wide OWNER obtain this exception.
  perform set_config('request.jwt.claim.sub',tenant_wide_owner::text,false);
  rejected := false;
  begin
    perform public.update_medical_appointment_status_backend(
      tenant_wide_owner,'RC922-TENANT-WIDE-PROVIDER','CANCELLED'
    );
  exception when others then
    if sqlerrm = 'ACTIVE_BUSINESS_MEMBERSHIP_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then raise exception 'RC922_TENANT_WIDE_OWNER_RECEIVED_PROVIDER_EXCEPTION'; end if;
end;
$test$;
reset role;
select 'RC922 tenant-wide SERVICE_PROVIDER exact-profile boundary: PASS' as result;
