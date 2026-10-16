do $$
declare
  v_user uuid := '10000000-0000-4000-8000-000000000001';
  v_result jsonb;
  v_membership_id varchar;
  v_count integer;
  v_status varchar;
begin
  insert into public.account_registration_requests(id,user_id,requested_role,status)
  values ('req-atomic-1',v_user,'CUSTOMER','PENDING');

  v_result := private.activate_customer_registration_atomic(v_user,'MNTY-PLATFORM');
  if v_result->>'created' <> 'true' or v_result->>'status' <> 'ACTIVE' then
    raise exception 'RC213 first activation result incorrect: %', v_result;
  end if;
  v_membership_id := v_result->>'membership_id';

  select count(*) into v_count from public.user_memberships
  where user_id=v_user and tenant_id='MNTY-PLATFORM' and role='CUSTOMER' and status='ACTIVE';
  if v_count <> 1 then raise exception 'RC213 must create exactly one active CUSTOMER membership, got %',v_count; end if;

  if not exists(select 1 from public.audit_logs where actor_user_id=v_user and action='CUSTOMER_REGISTRATION_ACTIVATED') then
    raise exception 'RC213 activation must persist its audit event';
  end if;
  select status into v_status from public.account_registration_requests where id='req-atomic-1';
  if v_status <> 'CANCELLED' then raise exception 'RC213 must cancel pending request on activation'; end if;

  insert into public.account_registration_requests(id,user_id,requested_role,status)
  values ('req-atomic-2',v_user,'CUSTOMER','PENDING');
  v_result := private.activate_customer_registration_atomic(v_user,'MNTY-PLATFORM');
  if v_result->>'created' <> 'false' or v_result->>'membership_id' <> v_membership_id then
    raise exception 'RC213 replay must return the existing membership: %',v_result;
  end if;
  select status into v_status from public.account_registration_requests where id='req-atomic-2';
  if v_status <> 'CANCELLED' then raise exception 'RC213 replay must cancel pending request'; end if;
end;
$$;

create or replace function public.test_fail_customer_audit_when_enabled()
returns trigger language plpgsql as $$
begin
  if current_setting('test.fail_customer_audit', true) = 'on' then
    raise exception 'forced_customer_audit_failure';
  end if;
  return new;
end;
$$;
create trigger test_fail_customer_audit
before insert on public.audit_logs
for each row execute function public.test_fail_customer_audit_when_enabled();

set test.fail_customer_audit = 'on';

do $$
declare
  v_user uuid := '10000000-0000-4000-8000-000000000002';
  v_failed boolean := false;
  v_count integer;
begin
  begin
    perform private.activate_customer_registration_atomic(v_user,'MNTY-PLATFORM');
  exception when others then
    if sqlerrm = 'forced_customer_audit_failure' then
      v_failed := true;
    else
      raise;
    end if;
  end;
  if not v_failed then raise exception 'RC213 must fail when its required audit write fails'; end if;
  select count(*) into v_count from public.user_memberships where user_id=v_user and role='CUSTOMER' and status='ACTIVE';
  if v_count <> 0 then raise exception 'RC213 audit failure must roll back membership creation'; end if;
end;
$$;

-- RC215 installs an auth.users trigger. With audit writes forced to fail,
-- the trigger must still create the base membership because this RPC catches
-- audit insertion errors in its nested exception block.
insert into auth.users(id,is_anonymous)
values ('10000000-0000-4000-8000-000000000003',false);

do $$
declare
  v_user uuid := '10000000-0000-4000-8000-000000000003';
  v_result jsonb;
  v_count integer;
  v_status varchar;
begin
  select count(*) into v_count from public.user_memberships
  where user_id=v_user and tenant_id='MNTY-PLATFORM' and role='CUSTOMER' and status='ACTIVE';
  if v_count <> 1 then raise exception 'RC215 auth.users trigger must create one membership despite audit failure, got %',v_count; end if;
  if exists(select 1 from public.audit_logs where actor_user_id=v_user and action='CUSTOMER_MEMBERSHIP_AUTO_ACTIVATED') then
    raise exception 'RC215 forced audit failure should not leave its audit row';
  end if;

  v_result := private.ensure_customer_membership_for_user(v_user,'MNTY-PLATFORM');
  if v_result->>'created' <> 'false' then raise exception 'RC215 replay must return created=false: %',v_result; end if;

  insert into public.account_registration_requests(id,user_id,requested_role,status)
  values ('req-ensure-1',v_user,'CUSTOMER','PENDING');
  v_result := private.ensure_customer_membership_for_user(v_user,'MNTY-PLATFORM');
  select status into v_status from public.account_registration_requests where id='req-ensure-1';
  if v_status <> 'PENDING' then raise exception 'RC215 does not own pending-request cleanup; expected PENDING, got %',v_status; end if;

  if exists(select 1 from public.user_memberships where user_id=v_user and (business_id is not null or branch_id is not null)) then
    raise exception 'RC215 platform CUSTOMER membership must not carry business/branch scope';
  end if;
end;
$$;

reset test.fail_customer_audit;

do $$
begin
  if not has_function_privilege('service_role','private.activate_customer_registration_atomic(uuid, character varying)','EXECUTE') then
    raise exception 'service_role must execute RC213';
  end if;
  if has_function_privilege('anon','private.activate_customer_registration_atomic(uuid, character varying)','EXECUTE')
    or has_function_privilege('authenticated','private.activate_customer_registration_atomic(uuid, character varying)','EXECUTE') then
    raise exception 'RC213 must not be directly executable by anon/authenticated';
  end if;
  if not has_function_privilege('service_role','private.ensure_customer_membership_for_user(uuid, character varying)','EXECUTE') then
    raise exception 'service_role must execute RC215';
  end if;
  if has_function_privilege('anon','private.ensure_customer_membership_for_user(uuid, character varying)','EXECUTE')
    or has_function_privilege('authenticated','private.ensure_customer_membership_for_user(uuid, character varying)','EXECUTE') then
    raise exception 'RC215 must not be directly executable by anon/authenticated';
  end if;
end;
$$;

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform private.activate_customer_registration_atomic('10000000-0000-4000-8000-000000000004','MNTY-INACTIVE-TEST');
  exception when others then
    if sqlerrm = 'active_tenant_required' then v_failed := true; else raise; end if;
  end;
  if not v_failed then raise exception 'RC213 must reject inactive tenants'; end if;

  v_failed := false;
  begin
    perform private.ensure_customer_membership_for_user('10000000-0000-4000-8000-000000000005','MNTY-INACTIVE-TEST');
  exception when others then
    if sqlerrm = 'active_tenant_required' then v_failed := true; else raise; end if;
  end;
  if not v_failed then raise exception 'RC215 must reject inactive tenants'; end if;
end;
$$;

select 'Customer registration RPC PostgreSQL integration: PASS' as result;
