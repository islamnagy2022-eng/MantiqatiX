-- RC213 behavioral test. Run only in disposable PostgreSQL.
do $test$
declare
  actor uuid := '10000000-0000-4000-8000-000000000001';
  inactive_actor uuid := '10000000-0000-4000-8000-000000000002';
  result jsonb;
  membership_count integer;
  audit_count integer;
  request_status text;
  rejected boolean;
begin
  insert into public.tenants(id,status) values('MNTY-PLATFORM','ACTIVE'),('TENANT-INACTIVE','INACTIVE');
  insert into public.account_registration_requests(user_id,requested_role,status)
    values(actor,'CUSTOMER','PENDING'),(actor,'SERVICE_PROVIDER','PENDING');

  result:=private.activate_customer_registration_atomic(actor,'MNTY-PLATFORM');
  if result->>'status'<>'ACTIVE' or result->>'created'<>'true' or result->>'role'<>'CUSTOMER' then
    raise exception 'customer activation did not create an active customer membership';
  end if;
  select count(*) into membership_count from public.user_memberships
  where user_id=actor and tenant_id='MNTY-PLATFORM' and upper(role)='CUSTOMER' and status='ACTIVE';
  if membership_count<>1 then raise exception 'customer activation should create exactly one membership'; end if;
  select status into request_status from public.account_registration_requests where user_id=actor and requested_role='CUSTOMER';
  if request_status<>'CANCELLED' then raise exception 'customer registration request should be closed after activation'; end if;

  result:=private.activate_customer_registration_atomic(actor,'MNTY-PLATFORM');
  if result->>'created'<>'false' then raise exception 'repeat activation should return existing membership'; end if;
  select count(*) into membership_count from public.user_memberships
  where user_id=actor and tenant_id='MNTY-PLATFORM' and upper(role)='CUSTOMER' and status='ACTIVE';
  if membership_count<>1 then raise exception 'repeat activation created duplicate customer membership'; end if;
  select count(*) into audit_count from public.audit_logs where actor_user_id=actor and action='CUSTOMER_REGISTRATION_ACTIVATED';
  if audit_count<>1 then raise exception 'idempotent repeat should not duplicate activation audit'; end if;

  rejected:=false;
  begin
    perform private.activate_customer_registration_atomic(inactive_actor,'TENANT-INACTIVE');
  exception when others then
    if sqlerrm='active_tenant_required' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'inactive tenant activation must be rejected'; end if;

  if has_function_privilege('anon','private.activate_customer_registration_atomic(uuid,character varying)','EXECUTE') then
    raise exception 'anon must not execute customer activation';
  end if;
  if has_function_privilege('authenticated','private.activate_customer_registration_atomic(uuid,character varying)','EXECUTE') then
    raise exception 'authenticated must not execute service-role activation';
  end if;
  if not has_function_privilege('service_role','private.activate_customer_registration_atomic(uuid,character varying)','EXECUTE') then
    raise exception 'service_role must execute customer activation';
  end if;
end;
$test$;
select 'RC213 customer activation integration: PASS' as result;
