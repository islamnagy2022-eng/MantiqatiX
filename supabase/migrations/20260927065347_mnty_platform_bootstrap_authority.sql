create or replace function private.bootstrap_platform_admin(
  p_user_id uuid,
  p_tenant_id varchar default 'MNTY_PLATFORM',
  p_tenant_name varchar default 'MNTY Platform',
  p_tenant_code varchar default 'MNTY-PLATFORM'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership_id varchar;
begin
  if p_user_id is null then raise exception 'user_id_required'; end if;
  if exists (select 1 from private.platform_admins) then
    raise exception 'platform_bootstrap_already_completed';
  end if;
  if not exists (select 1 from auth.users where id=p_user_id) then
    raise exception 'auth_user_not_found';
  end if;

  insert into public.tenants(id,name,code,status,settings)
  values(p_tenant_id,p_tenant_name,p_tenant_code,'ACTIVE','{}'::jsonb);

  v_membership_id := gen_random_uuid()::text;

  insert into public.user_memberships(
    id,user_id,tenant_id,role,permissions,status
  ) values (
    v_membership_id,p_user_id,p_tenant_id,'SUPER_ADMIN','[]'::jsonb,'ACTIVE'
  );

  insert into private.platform_admins(user_id)
  values(p_user_id);

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,
    old_values,new_values,result
  ) values (
    gen_random_uuid()::text,p_tenant_id,p_user_id,
    'PLATFORM_BOOTSTRAP','platform_admin',p_user_id::text,
    '{}'::jsonb,
    jsonb_build_object('tenant_id',p_tenant_id,'membership_id',v_membership_id,'role','SUPER_ADMIN'),
    'SUCCESS'
  );

  return jsonb_build_object(
    'ok',true,
    'tenant_id',p_tenant_id,
    'membership_id',v_membership_id,
    'platform_admin_user_id',p_user_id
  );
end;
$$;

revoke all on function private.bootstrap_platform_admin(uuid,varchar,varchar,varchar) from public, anon, authenticated;
grant execute on function private.bootstrap_platform_admin(uuid,varchar,varchar,varchar) to service_role;
