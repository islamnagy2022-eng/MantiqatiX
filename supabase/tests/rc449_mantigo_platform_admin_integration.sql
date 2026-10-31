-- RC449 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  tenant_owner uuid := '10000000-0000-4000-8000-000000000041';
  tenant_admin uuid := '10000000-0000-4000-8000-000000000042';
  tenant_ops uuid := '10000000-0000-4000-8000-000000000043';
  platform_admin uuid := '10000000-0000-4000-8000-000000000044';
  tenant_scoped_super_admin uuid := '10000000-0000-4000-8000-000000000045';
  platform_membership_only uuid := '10000000-0000-4000-8000-000000000046';
  registry_only_admin uuid := '10000000-0000-4000-8000-000000000047';
  rejected boolean;
  result jsonb;
begin
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions) values
    ('owner',tenant_owner,'TENANT-A','OWNER','ACTIVE','{"admin":true}'::jsonb),
    ('admin',tenant_admin,'TENANT-B','ADMIN','ACTIVE','{"admin":true}'::jsonb),
    ('ops',tenant_ops,'TENANT-C','OPERATIONS_MANAGER','ACTIVE','{"admin":true}'::jsonb),
    ('tenant-super',tenant_scoped_super_admin,'TENANT-D','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
    ('platform',platform_admin,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
    ('membership-only-platform',platform_membership_only,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb);

  insert into auth.users(id) values (platform_admin),(registry_only_admin);
  insert into private.platform_admins(user_id) values (platform_admin),(registry_only_admin);

  insert into public.mantigo_rides(id,customer_id,status,updated_at) values
    ('ride-stale-open',tenant_owner,'OPEN',pg_catalog.now()-interval '90 minutes'),
    ('ride-stale-bids',tenant_admin,'OPEN_FOR_BIDS',pg_catalog.now()-interval '45 minutes'),
    ('ride-recent-open',tenant_ops,'OPEN',pg_catalog.now()-interval '5 minutes'),
    ('ride-stale-matching',tenant_ops,'MATCHING',pg_catalog.now()-interval '90 minutes'),
    ('ride-rc449',tenant_owner,'COMPLETED',pg_catalog.now()-interval '1 hour');

  insert into public.mantigo_financial_ledger(id,ride_id,captain_id,gross_amount,commission_amount,captain_net_amount,commission_rate,payment_status,settlement_status,settlement_reference,amount,captain_amount)
  values ('ledger-rc449','ride-rc449',tenant_owner,100,10,90,0.10,'PAID','READY',null,100,90);

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
    perform public.settle_mantigo_captain_backend(tenant_owner,'ride-rc449','BANK_TRANSFER');
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
    raise exception 'explicitly registered platform admin should pass';
  end if;

  -- A platform-scoped membership alone is not the platform-root authority.
  perform pg_catalog.set_config('request.jwt.claim.sub',platform_membership_only::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'MNTY-PLATFORM membership without private registry entry must be denied';
  end if;

  -- The canonical registry is sufficient even when no MNTY-PLATFORM membership exists.
  perform pg_catalog.set_config('request.jwt.claim.sub',registry_only_admin::text,false);
  if not public.mnty_can_platform_admin() then
    raise exception 'private registry platform admin without tenant membership should pass';
  end if;
  result := public.get_mantigo_admin_dashboard_backend(registry_only_admin);
  if result is null then
    raise exception 'registry-only platform admin could not read MantiGO dashboard';
  end if;

  if has_table_privilege('anon','private.platform_admins','SELECT')
     or has_table_privilege('authenticated','private.platform_admins','SELECT') then
    raise exception 'platform admin registry must not be directly readable by client roles';
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
  if has_function_privilege('anon','public.settle_mantigo_captain_backend(uuid,text,text)','EXECUTE') then
    raise exception 'anon must not execute platform settlement';
  end if;
  if has_function_privilege('anon','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE') then
    raise exception 'anon must not execute platform ride expiration';
  end if;
  if not has_function_privilege('authenticated','public.get_mantigo_admin_dashboard_backend(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)','EXECUTE')
     or not has_function_privilege('authenticated','public.settle_mantigo_captain_backend(uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE') then
    raise exception 'authenticated role must retain intended RPC entrypoint grants; authorization is enforced inside each RPC';
  end if;

  -- Authorized platform-admin settlement is persisted and replay-safe.
  result := public.settle_mantigo_captain_backend(platform_admin,'ride-rc449','BANK_TRANSFER');
  if result->>'settlement_status' <> 'SETTLED' or coalesce((result->>'idempotent')::boolean,true) then
    raise exception 'authorized platform admin settlement failed: %',result;
  end if;
  if (select settlement_status from public.mantigo_financial_ledger where ride_id='ride-rc449') <> 'SETTLED'
     or (select settlement_reference from public.mantigo_financial_ledger where ride_id='ride-rc449') <> 'MGO-SET-ride-rc449' then
    raise exception 'authorized platform admin settlement did not persist ledger transition';
  end if;
  if (select count(*) from public.audit_logs where action='MANTIGO_CAPTAIN_SETTLED' and entity_id='ledger-rc449') <> 1
     or (select count(*) from public.notifications where type='MANTIGO_SETTLEMENT' and entity_id='ride-rc449') <> 1 then
    raise exception 'authorized platform admin settlement audit/notification missing';
  end if;
  result := public.settle_mantigo_captain_backend(platform_admin,'ride-rc449','BANK_TRANSFER');
  if coalesce((result->>'idempotent')::boolean,false) is not true then
    raise exception 'settlement replay did not return idempotent success';
  end if;
  if (select count(*) from public.audit_logs where action='MANTIGO_CAPTAIN_SETTLED' and entity_id='ledger-rc449') <> 1
     or (select count(*) from public.notifications where type='MANTIGO_SETTLEMENT' and entity_id='ride-rc449') <> 1 then
    raise exception 'settlement replay duplicated audit or notification';
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


-- Expand negative authorization coverage: every non-platform role must be rejected
-- by every global MantiGO RPC, not only by the shared guard helper.
create or replace function pg_temp.assert_mantigo_global_rpcs_denied(p_user uuid, p_role_label text)
returns void
language plpgsql
as $function$
declare
  v_rejected boolean;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub',p_user::text,false);

  v_rejected:=false;
  begin
    perform public.get_mantigo_admin_dashboard_backend(p_user);
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then v_rejected:=true; else raise; end if;
  end;
  if not v_rejected then raise exception '% accessed global MantiGO dashboard',p_role_label; end if;

  v_rejected:=false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(p_user,null,null);
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then v_rejected:=true; else raise; end if;
  end;
  if not v_rejected then raise exception '% accessed global MantiGO financial report',p_role_label; end if;

  v_rejected:=false;
  begin
    perform public.settle_mantigo_captain_backend(p_user,'ride-rc449','BANK_TRANSFER');
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then v_rejected:=true; else raise; end if;
  end;
  if not v_rejected then raise exception '% reached global MantiGO settlement',p_role_label; end if;

  v_rejected:=false;
  begin
    perform public.expire_stale_mantigo_rides_backend(p_user,30);
  exception when others then
    if sqlerrm='PLATFORM_ADMIN_REQUIRED' then v_rejected:=true; else raise; end if;
  end;
  if not v_rejected then raise exception '% reached global MantiGO ride expiration',p_role_label; end if;
end;
$function$;

select pg_temp.assert_mantigo_global_rpcs_denied('10000000-0000-4000-8000-000000000042','tenant ADMIN');
select pg_temp.assert_mantigo_global_rpcs_denied('10000000-0000-4000-8000-000000000043','tenant OPERATIONS_MANAGER');
select pg_temp.assert_mantigo_global_rpcs_denied('10000000-0000-4000-8000-000000000045','tenant-scoped SUPER_ADMIN');
select pg_temp.assert_mantigo_global_rpcs_denied('10000000-0000-4000-8000-000000000046','MNTY-PLATFORM membership without registry');

-- SECURITY DEFINER hardening must be consistent across all four global RPCs.
do $contract$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'get_mantigo_admin_dashboard_backend',
      'get_mantigo_admin_financial_report_backend',
      'settle_mantigo_captain_backend',
      'expire_stale_mantigo_rides_backend'
    )
    and p.prosecdef
    and coalesce(p.proconfig,array[]::text[]) @> array['search_path=""']::text[];
  if v_count<>4 then
    raise exception 'MANTIGO_DEFINER_CONFIG_FAILED: expected four SECURITY DEFINER RPCs with empty search_path, got %',v_count;
  end if;

  if not (
    has_function_privilege('authenticated','public.get_mantigo_admin_dashboard_backend(uuid)','EXECUTE')
    and has_function_privilege('authenticated','public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)','EXECUTE')
    and has_function_privilege('authenticated','public.settle_mantigo_captain_backend(uuid,text,text)','EXECUTE')
    and has_function_privilege('authenticated','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE')
  ) then
    raise exception 'MANTIGO_AUTHENTICATED_GRANTS_FAILED: intended authenticated entrypoints missing';
  end if;

  if (
    has_function_privilege('anon','public.get_mantigo_admin_dashboard_backend(uuid)','EXECUTE')
    or has_function_privilege('anon','public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)','EXECUTE')
    or has_function_privilege('anon','public.settle_mantigo_captain_backend(uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.expire_stale_mantigo_rides_backend(uuid,integer)','EXECUTE')
  ) then
    raise exception 'MANTIGO_ANON_GRANTS_FAILED: anon must not execute global RPCs';
  end if;
end;
$contract$;


-- Verify the same guard protects the live digital_pages_admin_manage RLS policy.
-- The table is granted to authenticated; only the policy should separate tenant
-- owners from the platform administrator.
insert into public.digital_pages(id,created_by,title)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000041','tenant owner page');

select pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000041',false);
set role authenticated;
do $tenant_rls$
declare
  v_count integer;
  v_rows integer;
  v_rejected boolean:=false;
begin
  select count(*) into v_count from public.digital_pages;
  if v_count<>0 then
    raise exception 'tenant OWNER read global digital_pages rows through platform-admin RLS';
  end if;

  update public.digital_pages set title='unauthorized update';
  get diagnostics v_rows=row_count;
  if v_rows<>0 then
    raise exception 'tenant OWNER updated global digital_pages through platform-admin RLS';
  end if;

  delete from public.digital_pages;
  get diagnostics v_rows=row_count;
  if v_rows<>0 then
    raise exception 'tenant OWNER deleted global digital_pages through platform-admin RLS';
  end if;

  begin
    insert into public.digital_pages(id,created_by,title)
    values ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000041','unauthorized page');
  exception when insufficient_privilege then
    v_rejected:=true;
  end;
  if not v_rejected then
    raise exception 'tenant OWNER inserted global digital_pages through platform-admin RLS';
  end if;
end;
$tenant_rls$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000044',false);
set role authenticated;
do $platform_rls$
declare
  v_count integer;
  v_rows integer;
begin
  select count(*) into v_count from public.digital_pages;
  if v_count<>1 then
    raise exception 'platform SUPER_ADMIN could not read global digital_pages';
  end if;

  update public.digital_pages set title='platform admin update';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'platform SUPER_ADMIN could not update global digital_pages';
  end if;

  insert into public.digital_pages(id,created_by,title)
  values ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000044','platform page');

  delete from public.digital_pages
  where id='20000000-0000-4000-8000-000000000003';
  get diagnostics v_rows=row_count;
  if v_rows<>1 then
    raise exception 'platform SUPER_ADMIN could not delete global digital_pages';
  end if;
end;
$platform_rls$;
reset role;

-- The global digital_pages policy follows the canonical registry, not a tenant membership.
select pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000047',false);
set role authenticated;
do $registry_only_rls$
declare
  v_count integer;
begin
  select count(*) into v_count from public.digital_pages;
  if v_count<>1 then
    raise exception 'registry-only platform admin could not read global digital_pages';
  end if;
end;
$registry_only_rls$;
reset role;

-- Removing the registry entry revokes platform authority immediately.
delete from private.platform_admins where user_id='10000000-0000-4000-8000-000000000047';
select pg_catalog.set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000047',false);
if public.mnty_can_platform_admin() then
  raise exception 'removed platform registry entry retained platform authority';
end if;

select 'RC462 canonical platform registry integration: PASS' as result;