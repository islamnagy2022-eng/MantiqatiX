-- RC462 regression: malformed JSON permission values must deny platform access without throwing.
-- Run only after RC462 in disposable PostgreSQL with rc441_platform_admin_fixture.sql.
do $test$
declare
  v_user uuid := '10000000-0000-4000-8000-000000000046';
  v_allowed boolean;
  v_rejected boolean;
begin
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions)
  values (
    'platform-malformed-rc462',
    v_user,
    'MNTY-PLATFORM',
    'SUPER_ADMIN',
    'ACTIVE',
    '{"scope":"PLATFORM","full_control":"not-a-boolean"}'::jsonb
  );

  perform pg_catalog.set_config('request.jwt.claim.sub',v_user::text,false);
  begin
    v_allowed := public.mnty_can_platform_admin();
  exception when others then
    raise exception 'RC462 must fail closed without raising for malformed full_control: %', sqlerrm;
  end;
  if v_allowed then
    raise exception 'RC462 malformed string full_control must not grant platform access';
  end if;

  -- The guard must protect the actual high-risk financial RPCs, not only return false.
  v_rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(v_user, null, null);
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then
    raise exception 'RC462 malformed full_control reached the platform-wide financial report';
  end if;

  v_rejected := false;
  begin
    perform public.settle_mantigo_captain_backend(v_user, 'ride-does-not-exist', 'BANK_TRANSFER');
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then
    raise exception 'RC462 malformed full_control reached the platform-wide settlement RPC';
  end if;

  update public.user_memberships
     set permissions = '{"scope":"PLATFORM","full_control":false}'::jsonb
   where id = 'platform-malformed-rc462';
  if public.mnty_can_platform_admin() then
    raise exception 'RC462 boolean false full_control must deny platform access';
  end if;

  v_rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(v_user, null, null);
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then
    raise exception 'RC462 boolean false reached the platform-wide financial report';
  end if;

  v_rejected := false;
  begin
    perform public.settle_mantigo_captain_backend(v_user, 'ride-does-not-exist', 'BANK_TRANSFER');
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then
      v_rejected := true;
    else
      raise;
    end if;
  end;
  if not v_rejected then
    raise exception 'RC462 boolean false reached the platform-wide settlement RPC';
  end if;

  -- A JSON string "true" must not be coerced into a Boolean authorization grant.
  update public.user_memberships
     set permissions = '{"scope":"PLATFORM","full_control":"true"}'::jsonb
   where id = 'platform-malformed-rc462';
  if public.mnty_can_platform_admin() then
    raise exception 'RC462 JSON string true must not grant platform access';
  end if;

  v_rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(v_user, null, null);
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'JSON string true reached platform-wide financial report';
  end if;

  v_rejected := false;
  begin
    perform public.settle_mantigo_captain_backend(v_user, 'ride-does-not-exist', 'BANK_TRANSFER');
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then
    raise exception 'JSON string true reached platform-wide settlement RPC';
  end if;

  update public.user_memberships
     set permissions = '{"scope":"PLATFORM","full_control":true}'::jsonb
   where id = 'platform-malformed-rc462';
  if not public.mnty_can_platform_admin() then
    raise exception 'RC462 valid explicit platform permission must continue to allow access';
  end if;
end
$test$;

select 'RC462 malformed platform-admin permissions regression: PASS' as result;
