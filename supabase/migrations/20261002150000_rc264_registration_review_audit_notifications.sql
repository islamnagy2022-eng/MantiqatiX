-- RC264: close registration-review audit and approval notification gap.
-- Rejection remains platform-scoped because a pending registration has no tenant membership yet.
create or replace function private.review_registration_request_atomic(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_decision text,
  p_tenant_id varchar default null,
  p_organization_id varchar default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_request public.account_registration_requests%rowtype;
  v_tenant public.tenants%rowtype;
  v_membership_id varchar;
  v_notification_tenant varchar;
begin
  if p_actor_user_id is null then raise exception 'actor_required'; end if;

  if not exists (
    select 1 from private.platform_admins pa
    where pa.user_id = p_actor_user_id
  ) then raise exception 'platform_admin_required'; end if;

  if p_decision not in ('APPROVED','REJECTED') then
    raise exception 'invalid_decision';
  end if;

  select * into v_request
  from public.account_registration_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'registration_not_found'; end if;
  if v_request.status <> 'PENDING' then raise exception 'registration_not_pending'; end if;

  if p_decision = 'APPROVED' and v_request.requested_role = 'SERVICE_PROVIDER' then
    raise exception 'provider_onboarding_required';
  end if;

  if p_decision = 'REJECTED' then
    update public.account_registration_requests
      set status='REJECTED', reviewed_by=p_actor_user_id,
          reviewed_at=now(), updated_at=now()
      where id=p_request_id;

    -- Account registrations are platform-scoped until a tenant membership exists.
    v_notification_tenant := 'MNTY-PLATFORM';

    insert into public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id,created_at
    ) values (
      pg_catalog.gen_random_uuid()::text,
      v_notification_tenant,
      v_request.user_id,
      'REGISTRATION_REJECTED',
      'Registration request rejected',
      'Your account registration request was rejected.',
      'account_registration_request',
      p_request_id::text,
      now()
    );

    insert into public.audit_logs(
      id,tenant_id,organization_id,actor_user_id,action,
      entity_type,entity_id,old_values,new_values,result
    ) values (
      pg_catalog.gen_random_uuid()::text,
      v_notification_tenant,
      p_organization_id,
      p_actor_user_id,
      'REGISTRATION_REJECTED',
      'account_registration_request',
      p_request_id::text,
      jsonb_build_object('status','PENDING'),
      jsonb_build_object('status','REJECTED','requested_role',v_request.requested_role),
      'SUCCESS'
    );

    return jsonb_build_object('status','REJECTED');
  end if;

  if p_tenant_id is null then raise exception 'tenant_id_required_for_approval'; end if;

  select * into v_tenant
  from public.tenants
  where id=p_tenant_id and status='ACTIVE';

  if not found then raise exception 'active_tenant_required'; end if;

  if exists (
    select 1 from public.user_memberships um
    where um.user_id=v_request.user_id
      and um.tenant_id=p_tenant_id
      and um.status='ACTIVE'
      and upper(um.role)=upper(v_request.requested_role)
  ) then
    raise exception 'membership_already_exists';
  end if;

  v_membership_id := pg_catalog.gen_random_uuid()::text;

  insert into public.user_memberships(
    id,user_id,tenant_id,organization_id,role,permissions,status
  ) values (
    v_membership_id,v_request.user_id,p_tenant_id,p_organization_id,
    v_request.requested_role,'[]'::jsonb,'ACTIVE'
  );

  update public.account_registration_requests
    set status='APPROVED', reviewed_by=p_actor_user_id,
        reviewed_at=now(), updated_at=now()
    where id=p_request_id;

  insert into public.audit_logs(
    id,tenant_id,organization_id,actor_user_id,action,
    entity_type,entity_id,old_values,new_values,result
  ) values (
    pg_catalog.gen_random_uuid()::text,p_tenant_id,p_organization_id,p_actor_user_id,
    'REGISTRATION_APPROVED','account_registration_request',
    p_request_id::text,
    jsonb_build_object('status','PENDING'),
    jsonb_build_object('status','APPROVED','membership_id',v_membership_id,'role',v_request.requested_role),
    'SUCCESS'
  );

  insert into public.notifications(
    id,tenant_id,user_id,type,title,body,entity_type,entity_id,created_at
  ) values (
    pg_catalog.gen_random_uuid()::text,
    p_tenant_id,
    v_request.user_id,
    'REGISTRATION_APPROVED',
    'Registration request approved',
    'Your account registration request was approved.',
    'account_registration_request',
    p_request_id::text,
    now()
  );

  return jsonb_build_object(
    'status','APPROVED',
    'membership_id',v_membership_id,
    'role',v_request.requested_role,
    'tenant_id',p_tenant_id
  );
end;
$function$;

comment on function private.review_registration_request_atomic(uuid,uuid,text,varchar,varchar)
is 'RC264 atomic registration review with audit records and user notifications.';
