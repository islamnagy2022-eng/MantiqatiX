-- Behavioral checks for RC215: trigger, idempotency, anonymous exclusion, and RPC grants.
\set ON_ERROR_STOP on

begin;

insert into auth.users(id, is_anonymous)
values ('10000000-0000-4000-8000-000000000001', false);

do $rc215_test$
declare
  v_count bigint;
  v_result jsonb;
begin
  select count(*) into v_count
  from public.user_memberships
  where user_id = '10000000-0000-4000-8000-000000000001'
    and tenant_id = 'MNTY-PLATFORM'
    and upper(role) = 'CUSTOMER'
    and status = 'ACTIVE';

  if v_count <> 1 then
    raise exception 'FAIL: permanent Auth user should receive exactly one active platform CUSTOMER membership; got %', v_count;
  end if;

  v_result := private.ensure_customer_membership_for_user(
    '10000000-0000-4000-8000-000000000001'::uuid,
    'MNTY-PLATFORM'
  );

  if v_result->>'created' <> 'false' or v_result->>'status' <> 'ACTIVE' then
    raise exception 'FAIL: repeated activation must return existing active membership without creating another row: %', v_result;
  end if;

  select count(*) into v_count
  from public.user_memberships
  where user_id = '10000000-0000-4000-8000-000000000001'
    and tenant_id = 'MNTY-PLATFORM'
    and upper(role) = 'CUSTOMER'
    and status = 'ACTIVE';

  if v_count <> 1 then
    raise exception 'FAIL: idempotent activation created duplicate active customer memberships; got %', v_count;
  end if;

  if has_function_privilege('anon', 'private.ensure_customer_membership_for_user(uuid, character varying)', 'EXECUTE') then
    raise exception 'FAIL: anon must not execute the private customer membership RPC';
  end if;
  if has_function_privilege('authenticated', 'private.ensure_customer_membership_for_user(uuid, character varying)', 'EXECUTE') then
    raise exception 'FAIL: authenticated clients must not execute the private customer membership RPC directly';
  end if;
  if not has_function_privilege('service_role', 'private.ensure_customer_membership_for_user(uuid, character varying)', 'EXECUTE') then
    raise exception 'FAIL: service_role must execute the private customer membership RPC';
  end if;
end
$rc215_test$;

do $rc215_test$
declare
  v_rejected boolean := false;
begin
  begin
    perform private.ensure_customer_membership_for_user(
      '10000000-0000-4000-8000-000000000001'::uuid,
      'MNTY-INACTIVE-TEST'
    );
  exception when others then
    if sqlerrm = 'active_tenant_required' then
      v_rejected := true;
    else
      raise;
    end if;
  end;

  if not v_rejected then
    raise exception 'FAIL: membership RPC must reject an inactive tenant';
  end if;
end
$rc215_test$;

insert into auth.users(id, is_anonymous)
values ('10000000-0000-4000-8000-000000000002', true);

do $rc215_test$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.user_memberships
  where user_id = '10000000-0000-4000-8000-000000000002';

  if v_count <> 0 then
    raise exception 'FAIL: anonymous Auth user must not receive a permanent customer membership; got % rows', v_count;
  end if;
end
$rc215_test$;

rollback;

select 'PASS: RC215 membership trigger, idempotency, anonymous exclusion, inactive-tenant denial, and service-role-only RPC grants' as result;
