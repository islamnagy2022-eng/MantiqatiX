-- RC215: Customer is a base membership for every MNTY account.
-- Every permanent account receives an ACTIVE CUSTOMER membership in MNTY-PLATFORM.
-- Additional roles (OWNER, ADMIN, SERVICE_PROVIDER, etc.) remain separate memberships.

create or replace function private.ensure_customer_membership_for_user(
  p_user_id uuid,
  p_tenant_id varchar default 'MNTY-PLATFORM'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_id varchar;
  v_membership_id varchar;
begin
  if p_user_id is null then
    raise exception 'user_required';
  end if;

  if p_tenant_id is null then
    raise exception 'tenant_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':CUSTOMER:' || p_tenant_id, 0));

  if not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
      and status = 'ACTIVE'
  ) then
    raise exception 'active_tenant_required';
  end if;

  select id
    into v_existing_id
  from public.user_memberships
  where user_id = p_user_id
    and tenant_id = p_tenant_id
    and upper(role) = 'CUSTOMER'
    and status = 'ACTIVE'
  order by created_at asc nulls first, id asc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object(
      'status','ACTIVE',
      'role','CUSTOMER',
      'tenant_id',p_tenant_id,
      'membership_id',v_existing_id,
      'created',false
    );
  end if;

  v_membership_id := gen_random_uuid()::text;

  insert into public.user_memberships(
    id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status
  ) values (
    v_membership_id,p_user_id,p_tenant_id,null,null,null,'CUSTOMER','{}'::jsonb,'ACTIVE'
  );

  begin
    insert into public.audit_logs(
      id,tenant_id,organization_id,actor_user_id,action,
      entity_type,entity_id,old_values,new_values,result
    ) values (
      gen_random_uuid()::text,p_tenant_id,null,p_user_id,
      'CUSTOMER_MEMBERSHIP_AUTO_ACTIVATED','user_membership',v_membership_id,
      jsonb_build_object('membership',null),
      jsonb_build_object('status','ACTIVE','role','CUSTOMER','membership_id',v_membership_id),
      'SUCCESS'
    );
  exception when others then
    -- Membership creation is the invariant; audit failure must not block signup.
    null;
  end;

  return jsonb_build_object(
    'status','ACTIVE',
    'role','CUSTOMER',
    'tenant_id',p_tenant_id,
    'membership_id',v_membership_id,
    'created',true
  );
end;
$function$;

revoke all on function private.ensure_customer_membership_for_user(uuid, varchar) from public, anon, authenticated;
grant execute on function private.ensure_customer_membership_for_user(uuid, varchar) to service_role;

create or replace function private.handle_auth_user_customer_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  perform private.ensure_customer_membership_for_user(new.id, 'MNTY-PLATFORM');
  return new;
end;
$function$;

revoke all on function private.handle_auth_user_customer_membership() from public, anon, authenticated;
grant execute on function private.handle_auth_user_customer_membership() to service_role;

drop trigger if exists on_mnty_auth_user_created_customer_membership on auth.users;

create trigger on_mnty_auth_user_created_customer_membership
  after insert on auth.users
  for each row
  execute function private.handle_auth_user_customer_membership();

-- Backfill every existing permanent account that does not yet have the base customer role.
do $$
declare
  r record;
begin
  for r in
    select u.id
    from auth.users u
    where coalesce(u.is_anonymous, false) = false
  loop
    perform private.ensure_customer_membership_for_user(r.id, 'MNTY-PLATFORM');
  end loop;
end;
$$;
