-- RC441 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  tenant_owner uuid := '10000000-0000-4000-8000-000000000041';
  tenant_admin uuid := '10000000-0000-4000-8000-000000000042';
  tenant_ops uuid := '10000000-0000-4000-8000-000000000043';
  platform_admin uuid := '10000000-0000-4000-8000-000000000044';
  tenant_scoped_super_admin uuid := '10000000-0000-4000-8000-000000000045';
  rejected boolean;
begin
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions) values
    ('owner',tenant_owner,'TENANT-A','OWNER','ACTIVE','{"admin":true}'::jsonb),
    ('admin',tenant_admin,'TENANT-B','ADMIN','ACTIVE','{"admin":true}'::jsonb),
    ('ops',tenant_ops,'TENANT-C','OPERATIONS_MANAGER','ACTIVE','{"admin":true}'::jsonb),
    ('tenant-super',tenant_scoped_super_admin,'TENANT-D','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
    ('platform',platform_admin,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb);

  insert into public.mantigo_rides(id,customer_id,status,updated_at) values
    ('ride-stale-open',tenant_owner,'OPEN',pg_catalog.now()-interval '90 minutes'),
    ('ride-stale-bids',tenant_admin,'OPEN_FOR_BIDS',pg_catalog.now()-interval '45 minutes'),
    ('ride-recent-open',tenant_ops,'OPEN',pg_catalog.now()-interval '5 minutes'),
    ('ride-stale-matching',tenant_ops,'MATCHING',pg_catalog.now()-interval '90 minutes');

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

  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_scoped_super_admin::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'tenant-scoped SUPER_ADMIN with PLATFORM permission must not gain platform access';
  end if;

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

  -- Stale ride expiration is idempotent, bounded to supported statuses, and audited.
  result := public.expire_stale_mantigo_rides_backend(platform_admin,30);
  if (result->>'expired_count')::integer <> 2 then
    raise exception 'expected two stale rides to expire, got %',result->>'expired_count';
  end if;
  if (select status from public.mantigo_rides where id='ride-stale-open') <> 'EXPIRED'
     or (select status from public.mantigo_rides where id='ride-stale-bids') <> 'EXPIRED' then
    raise exception 'stale OPEN/OPEN_FOR_BIDS rides were not expired';
  end if;
  if (select status from public.mantigo_rides where id='ride-recent-open') <> 'OPEN'
     or (select status from public.mantigo_rides where id='ride-stale-matching') <> 'MATCHING' then
    raise exception 'expiration touched a recent ride or unsupported status';
  end if;
  if (select count(*) from public.audit_logs where action='MANTIGO_RIDE_EXPIRED') <> 2 then
    raise exception 'expected one audit row per expired ride';
  end if;
  if (select count(*) from public.notifications where type='MANTIGO_EXPIRED') <> 2 then
    raise exception 'expected customer notifications for expired rides';
  end if;
  result := public.expire_stale_mantigo_rides_backend(platform_admin,30);
  if (result->>'expired_count')::integer <> 0 then
    raise exception 'repeat expiration should be idempotent';
  end if;
  if (select count(*) from public.audit_logs where action='MANTIGO_RIDE_EXPIRED') <> 2 then
    raise exception 'repeat expiration duplicated audit rows';
  end if;
end;
$test$;

select 'RC441 platform-admin scope integration: PASS' as result;
