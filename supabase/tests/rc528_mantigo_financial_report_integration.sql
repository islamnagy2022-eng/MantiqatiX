-- RC528 regression test. Run only against the disposable fixture in the RC528 workflow.
do $test$
declare
  platform_admin uuid := '10000000-0000-4000-8000-000000000526';
  tenant_admin uuid := '10000000-0000-4000-8000-000000000527';
  tenant_owner uuid := '10000000-0000-4000-8000-000000000528';
  tenant_super_admin uuid := '10000000-0000-4000-8000-000000000529';
  platform_string_true uuid := '10000000-0000-4000-8000-000000000530';
  result jsonb;
  rejected boolean;
  cfg text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mantigo_financial_ledger'
      and column_name in ('amount','captain_amount')
  ) then
    raise exception 'fixture must mirror canonical production schema and omit legacy amount columns';
  end if;

  if has_function_privilege('anon','public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'anon must not execute the financial report';
  end if;
  if not has_function_privilege('authenticated','public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'authenticated callers must reach the in-function platform-scope guard';
  end if;

  select pg_catalog.array_to_string(p.proconfig, ',') into cfg
  from pg_catalog.pg_proc p
  where p.oid='public.get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)'::regprocedure;
  if cfg not like '%search_path=%' then
    raise exception 'financial report must set a controlled search_path, got %',cfg;
  end if;

  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions) values
    ('platform-admin',platform_admin,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
    ('tenant-admin',tenant_admin,'TENANT-A','ADMIN','ACTIVE','{"admin":true}'::jsonb),
    ('tenant-owner',tenant_owner,'TENANT-B','OWNER','ACTIVE','{"admin":true}'::jsonb),
    ('tenant-super-admin',tenant_super_admin,'TENANT-C','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
    ('platform-string-true',platform_string_true,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":"true"}'::jsonb);

  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_owner::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'tenant OWNER must not be treated as platform administrator';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_super_admin::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'tenant-scoped SUPER_ADMIN must not be treated as platform administrator';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',platform_string_true::text,false);
  if public.mnty_can_platform_admin() then
    raise exception 'JSON string "true" must not satisfy boolean full_control';
  end if;

  insert into public.mantigo_financial_ledger
    (id,ride_id,captain_id,gross_amount,commission_amount,captain_net_amount,payment_status,settlement_status,created_at)
  values
    ('in-range-paid-settled','ride-526-a',platform_admin,100,10,90,'PAID','SETTLED','2026-10-10 12:00:00+00'),
    ('in-range-unpaid-ready','ride-526-b',tenant_admin,50,5,45,'PENDING','READY','2026-10-11 12:00:00+00'),
    ('out-of-range-paid','ride-526-c',tenant_admin,999,99,900,'PAID','SETTLED','2026-10-01 12:00:00+00');

  perform pg_catalog.set_config('request.jwt.claim.sub',platform_admin::text,false);
  result := public.get_mantigo_admin_financial_report_backend(platform_admin,'2026-10-09 00:00:00+00','2026-10-12 00:00:00+00');

  if (result->>'ledger_count')::integer <> 2
    or (result->>'gross')::numeric <> 150
    or (result->>'commission')::numeric <> 15
    or (result->>'captain_amount')::numeric <> 135
    or (result->>'paid_count')::integer <> 1
    or (result->>'paid_amount')::numeric <> 100
    or (result->>'settled_count')::integer <> 1
    or (result->>'settled_amount')::numeric <> 90
    or (result->>'unsettled_count')::integer <> 1
    or (result->>'unsettled_amount')::numeric <> 45 then
    raise exception 'unexpected RC528 report totals: %',result;
  end if;

  rejected := false;
  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_admin::text,false);
  begin
    perform public.get_mantigo_admin_financial_report_backend(tenant_admin,'2026-10-09 00:00:00+00','2026-10-12 00:00:00+00');
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then
    raise exception 'tenant-only admin unexpectedly read platform financial totals';
  end if;

  rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(platform_admin,'2026-10-09 00:00:00+00','2026-10-12 00:00:00+00');
  exception when others then
    if sqlerrm = 'AUTH_REQUIRED' then rejected := true; else raise; end if;
  end;
  if not rejected then
    raise exception 'actor spoof unexpectedly succeeded';
  end if;

  rejected := false;
  perform pg_catalog.set_config('request.jwt.claim.sub',platform_admin::text,false);
  begin
    perform public.get_mantigo_admin_financial_report_backend(platform_admin,'2026-10-12 00:00:00+00','2026-10-09 00:00:00+00');
  exception when others then
    if sqlerrm = 'INVALID_DATE_RANGE' then rejected := true; else raise; end if;
  end;
  if not rejected then
    raise exception 'invalid date range unexpectedly succeeded';
  end if;
end;
$test$;

select 'RC528 MantiGO financial report: PASS' as result;
