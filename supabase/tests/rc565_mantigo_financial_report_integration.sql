-- RC565 behavioral regression. Run only in disposable PostgreSQL after RC449 and RC565.
-- The shared RC449 fixture includes legacy aliases; remove them here to reproduce the canonical ledger schema.
alter table public.mantigo_financial_ledger drop column if exists amount;
alter table public.mantigo_financial_ledger drop column if exists captain_amount;

do $test$
declare
  platform_admin uuid := '10000000-0000-4000-8000-000000000044';
  tenant_owner uuid := '10000000-0000-4000-8000-000000000041';
  v_report jsonb;
  v_rejected boolean;
begin
  -- This test must work without legacy amount/captain_amount columns.
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='mantigo_financial_ledger'
      and column_name in ('amount','captain_amount')
  ) then
    raise exception 'RC565 fixture must omit legacy report columns';
  end if;

  insert into public.mantigo_financial_ledger(
    id, ride_id, captain_id, gross_amount, commission_amount, captain_net_amount,
    commission_rate, payment_status, settlement_status, settlement_reference, created_at
  ) values
    ('ledger-rc565-lower','ride-rc565-lower',tenant_owner,100,10,90,0.10,'PAID','SETTLED','SETTLE-LOWER','2026-10-10 00:00:00+00'),
    ('ledger-rc565-upper','ride-rc565-upper',tenant_owner,50,5,45,0.10,'CASH_CONFIRMED','READY',null,'2026-10-11 00:00:00+00'),
    ('ledger-rc565-before','ride-rc565-before',tenant_owner,25,2.5,22.5,0.10,'PENDING','HELD',null,'2026-10-09 23:59:59+00');

  perform pg_catalog.set_config('request.jwt.claim.sub',platform_admin::text,false);
  v_report := public.get_mantigo_admin_financial_report_backend(
    platform_admin,'2026-10-10 00:00:00+00','2026-10-11 00:00:00+00'
  );

  if (v_report->>'ledger_count')::integer <> 1 then
    raise exception 'RC565 half-open date window must include only the lower-bound row: %',v_report;
  end if;
  if (v_report->>'gross')::numeric <> 100
     or (v_report->>'commission')::numeric <> 10
     or (v_report->>'captain_amount')::numeric <> 90 then
    raise exception 'RC565 must aggregate gross_amount/commission_amount/captain_net_amount, not legacy aliases: %',v_report;
  end if;
  if (v_report->>'paid_count')::integer <> 1
     or (v_report->>'paid_amount')::numeric <> 100
     or (v_report->>'settled_count')::integer <> 1
     or (v_report->>'settled_amount')::numeric <> 90
     or (v_report->>'unsettled_count')::integer <> 0
     or (v_report->>'unsettled_amount')::numeric <> 0 then
    raise exception 'RC565 payment/settlement aggregates do not match the selected ledger row: %',v_report;
  end if;

  v_report := public.get_mantigo_admin_financial_report_backend(
    platform_admin,'2026-10-12 00:00:00+00','2026-10-13 00:00:00+00'
  );
  if (v_report->>'ledger_count')::integer <> 0
     or (v_report->>'gross')::numeric <> 0
     or (v_report->>'commission')::numeric <> 0
     or (v_report->>'captain_amount')::numeric <> 0 then
    raise exception 'RC565 empty range must return zero aggregates: %',v_report;
  end if;

  v_rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(
      platform_admin,'2026-10-11 00:00:00+00','2026-10-11 00:00:00+00'
    );
  exception when others then
    if sqlerrm = 'INVALID_REPORT_WINDOW' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC565 must reject an empty/reversed report window'; end if;

  perform pg_catalog.set_config('request.jwt.claim.sub',tenant_owner::text,false);
  v_rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(tenant_owner,null,null);
  exception when others then
    if sqlerrm = 'PLATFORM_ADMIN_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC565 allowed tenant OWNER to read platform-wide financial aggregates'; end if;

  v_rejected := false;
  begin
    perform public.get_mantigo_admin_financial_report_backend(platform_admin,null,null);
  exception when others then
    if sqlerrm = 'AUTH_REQUIRED' then v_rejected := true; else raise; end if;
  end;
  if not v_rejected then raise exception 'RC565 must reject an actor/id mismatch'; end if;
end
$test$;

select 'RC565 financial report PostgreSQL integration: PASS' as result;
