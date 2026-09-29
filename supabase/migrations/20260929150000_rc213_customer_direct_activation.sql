-- RC213: Customer self-registration activates a CUSTOMER membership directly.
-- The production function was created through the controlled SQL execution path;
-- this migration records the exact production definition for source convergence.

create or replace function private.activate_customer_registration_atomic(
  p_user_id uuid,
  p_tenant_id varchar default 'MNTY-PLATFORM'
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant public.tenants%rowtype;
  v_membership_id varchar;
  v_existing_id varchar;
begin
  if p_user_id is null then raise exception 'user_required'; end if;
  if p_tenant_id is null then raise exception 'tenant_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select * into v_tenant from public.tenants
  where id = p_tenant_id and status = 'ACTIVE';
  if not found then raise exception 'active_tenant_required'; end if;

  select id into v_existing_id
  from public.user_memberships
  where user_id = p_user_id
    and tenant_id = p_tenant_id
    and upper(role) = 'CUSTOMER'
    and status = 'ACTIVE'
  limit 1;

  if v_existing_id is not null then
    update public.account_registration_requests
      set status = 'CANCELLED', updated_at = now()
      where user_id = p_user_id
        and requested_role = 'CUSTOMER'
        and status = 'PENDING';

    return jsonb_build_object('status','ACTIVE','membership_id',v_existing_id,
      'role','CUSTOMER','tenant_id',p_tenant_id,'created',false);
  end if;

  v_membership_id := gen_random_uuid()::text;

  insert into public.user_memberships(
    id,user_id,tenant_id,organization_id,role,permissions,status
  ) values (
    v_membership_id,p_user_id,p_tenant_id,null,'CUSTOMER','{}'::jsonb,'ACTIVE'
  );

  update public.account_registration_requests
    set status = 'CANCELLED', updated_at = now()
    where user_id = p_user_id
      and requested_role = 'CUSTOMER'
      and status = 'PENDING';

  insert into public.audit_logs(
    id,tenant_id,organization_id,actor_user_id,action,
    entity_type,entity_id,old_values,new_values,result
  ) values (
    gen_random_uuid()::text,p_tenant_id,null,p_user_id,
    'CUSTOMER_REGISTRATION_ACTIVATED','user_membership',v_membership_id,
    jsonb_build_object('membership',null),
    jsonb_build_object('status','ACTIVE','role','CUSTOMER','membership_id',v_membership_id),
    'SUCCESS'
  );

  return jsonb_build_object('status','ACTIVE','membership_id',v_membership_id,
    'role','CUSTOMER','tenant_id',p_tenant_id,'created',true);
end;
$function$;

revoke execute on function private.activate_customer_registration_atomic(uuid, varchar)
  from public, anon, authenticated;
grant execute on function private.activate_customer_registration_atomic(uuid, varchar)
  to service_role;
