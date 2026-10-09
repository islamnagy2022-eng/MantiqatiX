-- RC441 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  tenant_owner uuid := '10000000-0000-4000-8000-000000000041';
  tenant_admin uuid := '10000000-0000-4000-8000-000000000042';
  tenant_ops uuid := '10000000-0000-4000-8000-000000000043';
  platform_admin uuid := '10000000-0000-4000-8000-000000000044';
  rejected boolean;
begin
  insert into public.user_memberships(id,user_id,role,status,permissions) values
    ('owner',tenant_owner,'OWNER','ACTIVE','{"admin":true}'::jsonb),
    ('admin',tenant_admin,'ADMIN','ACTIVE','{"admin":true}'::jsonb),
    ('ops',tenant_ops,'OPERATIONS_MANAGER','ACTIVE','{"admin":true}'::jsonb),
    ('platform',platform_admin,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb);

  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_owner::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'tenant OWNER must not be treated as platform administrator';
  end if;

  rejected:=false;
  begin
    perform public.get_mantigo_admin_dashboard_backend(tenant_owner);
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'tenant OWNER read platform-wide dashboard'; end if;

  rejected:=false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(tenant_owner,null,null);
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'tenant OWNER read platform-wide financial report'; end if;

  rejected:=false;
  begin
    perform public.settle_mantigo_captain_backend(tenant_owner,'ride-rc441','BANK_TRANSFER');
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'tenant OWNER reached global settlement mutation'; end if;

  rejected:=false;
  begin
    perform public.expire_stale_mantigo_rides_backend(tenant_owner,30);
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'tenant OWNER reached global ride expiration mutation'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_admin::text,false);
  if public.mnty_can_platform_admin() then raise exception 'tenant ADMIN with admin permission must not gain platform scope'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_ops::text,false);
  if public.mnty_can_platform_admin() then raise exception 'tenant OPERATIONS_MANAGER must not gain platform scope'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',platform_admin::text,false);
  if not public.mnty_can_platform_admin() then
    raise exception 'explicit platform SUPER_ADMIN with full_control should pass';
  end if;

  if has_function_privilege('anon','public.mnty_can_platform_admin()','EXECUTE') then
    raise exception 'anon must not execute platform-admin guard';
  end if;
  if not has_function_privilege('authenticated','public.mnty_can_platform_admin()','EXECUTE') then
    raise exception 'authenticated role must execute platform-admin guard for policy checks';
  end if;
  if has_function_privilege('anon','public.get_mantigo_admin_dashboard_backend(uuid)','EXECUTE') then
    raise exception 'anon must not execute platform dashboard';
  end if;
  if has_function_privilege('anon','public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)','EXECUTE') then
    raise exception 'anon must not execute platform financial report';
  end if;
end;
$test$;

select 'RC441 platform-admin scope integration: PASS' as result;
