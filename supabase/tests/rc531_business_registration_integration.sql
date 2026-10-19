set request.jwt.claim.role = 'service_role';

create or replace function public.test_fail_business_approval_insert()
returns trigger language plpgsql as $$
begin
  if current_setting('test.fail_approval_insert', true) = 'on' then
    raise exception 'forced_approval_insert_failure';
  end if;
  return new;
end;
$$;
create trigger test_fail_business_approval_insert
before insert on public.approval_requests
for each row execute function public.test_fail_business_approval_insert();

do $test$
declare
  v_result jsonb;
  v_duplicate jsonb;
  v_before integer;
  v_after integer;
  v_business_id uuid;
  v_failed boolean := false;
begin
  -- Non-UUID tenant and organization identifiers are valid varchar contract values.
  v_result := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000001','TENANT-A','ORG-A',
    'Agency One','AGENCY-ONE-001','MARKETING','Address','01000000000','Giza','Dokki'
  );
  if v_result->>'success' <> 'true' then
    raise exception 'RC531 expected successful atomic registration, got %',v_result;
  end if;
  v_business_id := (v_result->'business'->>'id')::uuid;
  if not exists(select 1 from public.businesses where id=v_business_id and status='INACTIVE' and tenant_id='TENANT-A') then
    raise exception 'RC531 business must be created inactive in the requested tenant';
  end if;
  if not exists(select 1 from public.approval_requests where business_id=v_business_id and status='PENDING' and requested_by='10000000-0000-4000-8000-000000000001') then
    raise exception 'RC531 approval request must be created with the business';
  end if;

  v_duplicate := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000001','TENANT-A','ORG-A',
    'Agency Duplicate','AGENCY-DUPLICATE-001','MARKETING','','','',''
  );
  if v_duplicate->>'success' <> 'false' or v_duplicate->>'error' <> 'PENDING_BUSINESS_REQUEST_EXISTS' then
    raise exception 'RC531 duplicate pending registration must be rejected, got %',v_duplicate;
  end if;
  select count(*) into v_after from public.businesses where tenant_id='TENANT-A';
  if v_after <> 1 then raise exception 'RC531 duplicate attempt must not create another business, count=%',v_after; end if;

  -- A platform super-admin in MNTY-PLATFORM may create in another active tenant.
  v_result := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000004','TENANT-B','ORG-B',
    'Platform Agency','PLATFORM-AGENCY-001','GENERAL','','','',''
  );
  if v_result->>'success' <> 'true' then
    raise exception 'RC531 explicit platform super-admin scope should permit target-tenant creation, got %',v_result;
  end if;

  v_result := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000002','TENANT-A','ORG-B',
    'Cross Tenant','CROSS-TENANT-001','GENERAL','','','',''
  );
  if v_result->>'success' <> 'false' then
    raise exception 'RC531 must reject membership/organization scope mismatch, got %',v_result;
  end if;

  v_result := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000003','TENANT-A','ORG-B',
    'Corrupt Org Scope','CORRUPT-ORG-SCOPE-001','GENERAL','','','',''
  );
  if v_result->>'success' <> 'false' or v_result->>'error' <> 'ORGANIZATION_SCOPE_FORBIDDEN' then
    raise exception 'RC531 must reject an organization belonging to another tenant, got %',v_result;
  end if;

  v_result := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000005','TENANT-A',null,
    'Inherited Corrupt Organization','INHERITED-CORRUPT-ORG-001','GENERAL','','','',''
  );
  if v_result->>'success' <> 'false' or v_result->>'error' <> 'ORGANIZATION_SCOPE_FORBIDDEN' then
    raise exception 'RC531 must reject cross-tenant inherited membership organization, got %',v_result;
  end if;

  v_result := public.register_business_with_approval_atomic(
    '10000000-0000-4000-8000-000000000001','TENANT-INACTIVE',null,
    'Inactive Tenant','INACTIVE-TENANT-001','GENERAL','','','',''
  );
  if v_result->>'success' <> 'false' or v_result->>'error' <> 'ACTIVE_TENANT_REQUIRED' then
    raise exception 'RC531 must reject inactive tenant, got %',v_result;
  end if;

  select count(*) into v_before from public.businesses;
  perform set_config('test.fail_approval_insert','on',true);
  begin
    perform public.register_business_with_approval_atomic(
      '10000000-0000-4000-8000-000000000003','TENANT-A','ORG-A',
      'Rollback Test','ROLLBACK-TEST-001','GENERAL','','','',''
    );
  exception when others then
    if sqlerrm='forced_approval_insert_failure' then v_failed:=true; else raise; end if;
  end;
  perform set_config('test.fail_approval_insert','off',true);
  if not v_failed then raise exception 'RC531 forced approval failure should propagate'; end if;
  select count(*) into v_after from public.businesses;
  if v_after <> v_before then
    raise exception 'RC531 must roll back business insert when approval insert fails; before %, after %',v_before,v_after;
  end if;

  -- The SECURITY DEFINER function must still reject calls whose JWT role is not service_role.
  select count(*) into v_before from public.businesses;
  perform set_config('request.jwt.claim.role','authenticated',true);
  v_failed := false;
  begin
    perform public.register_business_with_approval_atomic(
      '10000000-0000-4000-8000-000000000003','TENANT-A','ORG-A',
      'Untrusted Role','UNTRUSTED-ROLE-001','GENERAL','','','',''
    );
  exception when others then
    if sqlerrm='TRUSTED_BUSINESS_REGISTRATION_REQUIRED' then v_failed:=true; else raise; end if;
  end;
  perform set_config('request.jwt.claim.role','service_role',true);
  if not v_failed then raise exception 'RC531 must reject a non-service-role JWT even when function privileges are available'; end if;
  select count(*) into v_after from public.businesses;
  if v_after <> v_before then raise exception 'RC531 rejected-role call must not create a business'; end if;

$test$;

do $privileges$
begin
  if not has_function_privilege('service_role','public.register_business_with_approval_atomic(uuid,character varying,character varying,character varying,character varying,character varying,text,character varying,character varying,character varying)','EXECUTE') then
    raise exception 'RC531 service_role must execute registration RPC';
  end if;
  if has_function_privilege('anon','public.register_business_with_approval_atomic(uuid,character varying,character varying,character varying,character varying,character varying,text,character varying,character varying,character varying)','EXECUTE')
    or has_function_privilege('authenticated','public.register_business_with_approval_atomic(uuid,character varying,character varying,character varying,character varying,character varying,text,character varying,character varying,character varying)','EXECUTE') then
    raise exception 'RC531 registration RPC must not be callable by anon/authenticated';
  end if;
end;
$privileges$;
