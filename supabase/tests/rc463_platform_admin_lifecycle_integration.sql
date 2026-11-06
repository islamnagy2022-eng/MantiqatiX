-- RC463 lifecycle integration test. Run only against the disposable fixture.
do $test$
declare
  root_one constant uuid := '10000000-0000-4000-8000-000000000001';
  root_two constant uuid := '10000000-0000-4000-8000-000000000002';
  tenant_owner constant uuid := '10000000-0000-4000-8000-000000000003';
  unconfirmed_user constant uuid := '10000000-0000-4000-8000-000000000004';
  result jsonb;
  rejected boolean;
  event_count integer;
  member_status text;
  member_scope text;
  member_full_control boolean;
begin
  if not has_function_privilege('service_role',
      'private.bootstrap_platform_admin(uuid,character varying,character varying,character varying)','EXECUTE')
     or has_function_privilege('anon',
      'private.bootstrap_platform_admin(uuid,character varying,character varying,character varying)','EXECUTE')
     or has_function_privilege('authenticated',
      'private.bootstrap_platform_admin(uuid,character varying,character varying,character varying)','EXECUTE') then
    raise exception 'RC463_BOOTSTRAP_EXECUTE_ACL_FAILED';
  end if;

  if not has_function_privilege('service_role',
      'private.grant_platform_admin(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon',
      'private.grant_platform_admin(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated',
      'private.grant_platform_admin(uuid,uuid,text)','EXECUTE') then
    raise exception 'RC463_GRANT_EXECUTE_ACL_FAILED';
  end if;

  if not has_function_privilege('service_role',
      'private.revoke_platform_admin(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon',
      'private.revoke_platform_admin(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated',
      'private.revoke_platform_admin(uuid,uuid,text)','EXECUTE') then
    raise exception 'RC463_REVOKE_EXECUTE_ACL_FAILED';
  end if;

  if has_table_privilege('anon','private.platform_admin_lifecycle_events','SELECT')
     or has_table_privilege('authenticated','private.platform_admin_lifecycle_events','SELECT')
     or has_table_privilege('anon','private.platform_admin_lifecycle_events','INSERT')
     or has_table_privilege('authenticated','private.platform_admin_lifecycle_events','INSERT') then
    raise exception 'RC463_LIFECYCLE_EVENT_TABLE_EXPOSED';
  end if;

  if not has_table_privilege('service_role','private.platform_admin_lifecycle_events','SELECT')
     or not has_table_privilege('service_role','private.platform_admin_lifecycle_events','INSERT') then
    raise exception 'RC463_SERVICE_ROLE_EVENT_ACCESS_MISSING';
  end if;

  -- Canonical tenant already exists: bootstrap must reuse it, not create MNTY_PLATFORM.
  result := private.bootstrap_platform_admin(root_one);
  if result->>'status' <> 'BOOTSTRAPPED' then
    raise exception 'RC463_BOOTSTRAP_FAILED: %', result;
  end if;
  if (select count(*) from public.tenants where id='MNTY-PLATFORM' and code='MNTY') <> 1
     or exists(select 1 from public.tenants where id='MNTY_PLATFORM')
     or exists(select 1 from public.tenants where code='MNTY-PLATFORM') then
    raise exception 'RC463_BOOTSTRAP_CREATED_PARALLEL_OR_WRONG_TENANT';
  end if;
  if (select count(*) from private.platform_admins) <> 1
     or not exists(select 1 from private.platform_admins where user_id=root_one) then
    raise exception 'RC463_BOOTSTRAP_REGISTRY_ROW_MISSING';
  end if;

  select status, permissions->>'scope', (permissions->>'full_control')::boolean
    into member_status, member_scope, member_full_control
    from public.user_memberships
   where user_id=root_one and tenant_id='MNTY-PLATFORM'
     and upper(role)='SUPER_ADMIN' and business_id is null and branch_id is null;
  if member_status <> 'ACTIVE' or member_scope <> 'PLATFORM' or member_full_control is distinct from true then
    raise exception 'RC463_BOOTSTRAP_MEMBERSHIP_SCOPE_FAILED';
  end if;

  if (select count(*) from private.platform_admin_lifecycle_events where event_type='BOOTSTRAP') <> 1
     or exists(select 1 from private.platform_admin_lifecycle_events where event_type='BOOTSTRAP' and actor_user_id is not null) then
    raise exception 'RC463_BOOTSTRAP_AUDIT_FAILED';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',root_one::text,false);
  if not public.mnty_can_platform_admin() then
    raise exception 'RC463_CANONICAL_REGISTRY_HELPER_DENIED_BOOTSTRAPPED_ROOT';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_owner::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'RC463_CANONICAL_REGISTRY_HELPER_GRANTED_TENANT_OWNER';
  end if;

  -- A different tenant ID/code tuple must be rejected; no alternate platform tenant is created.
  rejected := false;
  begin
    perform private.bootstrap_platform_admin(root_two,'MNTY_PLATFORM','MNTY Platform','MNTY-PLATFORM');
  exception when others then
    if sqlerrm='PLATFORM_BOOTSTRAP_CANONICAL_TENANT_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'RC463_NONCANONICAL_BOOTSTRAP_ARGUMENTS_ACCEPTED'; end if;

  -- Second bootstrap is rejected after first root is established.
  rejected := false;
  begin
    perform private.bootstrap_platform_admin(root_two);
  exception when others then
    if sqlerrm='PLATFORM_BOOTSTRAP_ALREADY_INITIALIZED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'RC463_SECOND_BOOTSTRAP_ACCEPTED'; end if;

  -- A tenant OWNER with broad tenant permissions is not a root actor.
  rejected := false;
  begin
    perform private.grant_platform_admin(tenant_owner,root_two,'Attempt from tenant owner');
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'RC463_TENANT_OWNER_GRANTED_PLATFORM_ADMIN'; end if;

  -- An unconfirmed Auth identity cannot receive root authority.
  rejected := false;
  begin
    perform private.grant_platform_admin(root_one,unconfirmed_user,'Attempt to grant unconfirmed user');
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_TARGET_USER_NOT_ELIGIBLE' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'RC463_UNCONFIRMED_USER_GRANTED_PLATFORM_ADMIN'; end if;

  result := private.grant_platform_admin(root_one,root_two,'Approved second platform administrator');
  if result->>'status' <> 'GRANTED' then
    raise exception 'RC463_GRANT_FAILED: %', result;
  end if;
  if (select count(*) from private.platform_admins) <> 2
     or not exists(select 1 from private.platform_admins where user_id=root_two) then
    raise exception 'RC463_GRANT_REGISTRY_ROW_MISSING';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',root_two::text,false);
  if not public.mnty_can_platform_admin() then
    raise exception 'RC463_CANONICAL_REGISTRY_HELPER_DENIED_GRANTED_ROOT';
  end if;

  if not exists(
    select 1 from public.user_memberships
    where user_id=root_two and tenant_id='MNTY-PLATFORM'
      and upper(role)='SUPER_ADMIN' and status='ACTIVE'
      and permissions->>'scope'='PLATFORM'
      and coalesce((permissions->>'full_control')::boolean,false)
      and business_id is null and branch_id is null
  ) then
    raise exception 'RC463_GRANT_MEMBERSHIP_MISSING';
  end if;

  select count(*) into event_count from private.platform_admin_lifecycle_events;
  result := private.grant_platform_admin(root_one,root_two,'Duplicate grant should not add a root');
  if result->>'status' <> 'ALREADY_PLATFORM_ADMIN' then
    raise exception 'RC463_DUPLICATE_GRANT_NOT_IDEMPOTENT: %', result;
  end if;
  if (select count(*) from private.platform_admin_lifecycle_events) <> event_count then
    raise exception 'RC463_DUPLICATE_GRANT_CREATED_AUDIT_EVENT';
  end if;

  result := private.revoke_platform_admin(root_one,root_two,'Approved removal of second platform administrator');
  if result->>'status' <> 'REVOKED' then
    raise exception 'RC463_REVOKE_FAILED: %', result;
  end if;
  if exists(select 1 from private.platform_admins where user_id=root_two) then
    raise exception 'RC463_REVOKED_ROOT_REMAINS_IN_REGISTRY';
  end if;

  select status, permissions->>'scope', (permissions->>'full_control')::boolean
    into member_status, member_scope, member_full_control
    from public.user_memberships
   where user_id=root_two and tenant_id='MNTY-PLATFORM'
     and upper(role)='SUPER_ADMIN' and business_id is null and branch_id is null;
  if member_status <> 'INACTIVE' or member_scope <> 'PLATFORM' or member_full_control is distinct from false then
    raise exception 'RC463_REVOKED_MEMBERSHIP_REMAINS_ACTIVE';
  end if;

  if (select count(*) from private.platform_admin_lifecycle_events where event_type='REVOKED' and actor_user_id=root_one and target_user_id=root_two) <> 1 then
    raise exception 'RC463_REVOKE_AUDIT_MISSING';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',root_two::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'RC463_CANONICAL_REGISTRY_HELPER_RETAINED_REVOKED_ROOT';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',root_one::text,false);
  if not public.mnty_can_platform_admin() then
    raise exception 'RC463_CANONICAL_REGISTRY_HELPER_REVOKED_REMAINING_ROOT';
  end if;

  -- Platform membership is also deactivated so the pre-RC462 guard cannot retain authority.
  if exists(
    select 1 from public.user_memberships
    where user_id=root_two and tenant_id='MNTY-PLATFORM' and upper(role)='SUPER_ADMIN'
      and status='ACTIVE' and permissions->>'scope'='PLATFORM'
      and coalesce((permissions->>'full_control')::boolean,false)
  ) then
    raise exception 'RC463_REVOKED_MEMBERSHIP_STILL_PASSES_LEGACY_GUARD';
  end if;

  -- A remaining root can grant another root, and revoke the former administrator.
  result := private.grant_platform_admin(root_one,root_two,'Reinstate second platform administrator for transfer test');
  if result->>'status' <> 'GRANTED' then raise exception 'RC463_REGRANT_FAILED: %',result; end if;

  result := private.revoke_platform_admin(root_two,root_one,'Transfer root authority to second administrator');
  if result->>'status' <> 'REVOKED' then raise exception 'RC463_ROOT_TRANSFER_FAILED: %',result; end if;
  if exists(select 1 from private.platform_admins where user_id=root_one)
     or not exists(select 1 from private.platform_admins where user_id=root_two) then
    raise exception 'RC463_ROOT_TRANSFER_STATE_FAILED';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',root_one::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'RC463_ROOT_TRANSFER_DID_NOT_REVOKE_HELPER_AUTHORITY';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',root_two::text,false);
  if not public.mnty_can_platform_admin() then
    raise exception 'RC463_ROOT_TRANSFER_REVOKED_NEW_ROOT';
  end if;

  rejected := false;
  begin
    perform private.revoke_platform_admin(root_two,root_two,'Attempt self revocation');
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_SELF_REVOCATION_NOT_ALLOWED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'RC463_SELF_REVOCATION_WAS_ALLOWED'; end if;

  if (select count(*) from private.platform_admin_lifecycle_events where event_type='BOOTSTRAP') <> 1
     or (select count(*) from private.platform_admin_lifecycle_events where event_type='GRANTED') <> 2
     or (select count(*) from private.platform_admin_lifecycle_events where event_type='REVOKED') <> 2 then
    raise exception 'RC463_LIFECYCLE_AUDIT_COUNTS_FAILED';
  end if;
end;
$test$;

select 'RC463 platform-admin bootstrap/grant/revocation integration: PASS' as result;
