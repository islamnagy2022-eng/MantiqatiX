-- RC523 regression test. Run only in disposable PostgreSQL using rc441_platform_admin_fixture.sql.
-- Deliberately make legacy columns disagree with canonical columns to detect regressions.
do $test$
declare
  v_admin uuid := '10000000-0000-4000-8000-000000000044';
  v_report jsonb;
begin
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions)
  values ('platform-rc523',v_admin,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE',
    '{"scope":"PLATFORM","full_control":true}'::jsonb);

  insert into public.mantigo_financial_ledger(
    id,ride_id,captain_id,gross_amount,commission_amount,captain_net_amount,
    commission_rate,payment_status,settlement_status,amount,captain_amount,created_at,updated_at
  ) values (
    'ledger-rc523','ride-rc523',v_admin,250,25,200,0.10,'PAID','READY',999,888,
    pg_catalog.now(),pg_catalog.now()
  );

  perform pg_catalog.set_config('request.jwt.claim.sub',v_admin::text,false);
  if public.get_mantigo_admin_financial_report_backend(v_admin,null,null) is null then
    raise exception 'RC523 report must not be null';
  end if;
  v_report := public.get_mantigo_admin_financial_report_backend(v_admin,null,null);

  if (v_report->>'ledger_count')::bigint <> 1 then
    raise exception 'RC523 ledger_count mismatch: %',v_report;
  end if;
  if (v_report->>'gross')::numeric <> 250 then
    raise exception 'RC523 gross must use gross_amount, not legacy amount: %',v_report;
  end if;
  if (v_report->>'commission')::numeric <> 25 then
    raise exception 'RC523 commission mismatch: %',v_report;
  end if;
  if (v_report->>'captain_amount')::numeric <> 200 then
    raise exception 'RC523 captain_amount must use captain_net_amount, not legacy captain_amount: %',v_report;
  end if;
  if (v_report->>'paid_count')::bigint <> 1 or (v_report->>'paid_amount')::numeric <> 250 then
    raise exception 'RC523 paid metrics mismatch: %',v_report;
  end if;
  if (v_report->>'settled_count')::bigint <> 0 or (v_report->>'settled_amount')::numeric <> 0 then
    raise exception 'RC523 settled metrics mismatch: %',v_report;
  end if;
  if (v_report->>'unsettled_count')::bigint <> 1 or (v_report->>'unsettled_amount')::numeric <> 200 then
    raise exception 'RC523 unsettled metrics mismatch: %',v_report;
  end if;
  if not (v_report ? 'captain_amount') or (v_report ? 'captain_net_amount') then
    raise exception 'RC523 public JSON response keys changed unexpectedly: %',v_report;
  end if;

  -- Prove the RPC runs on the canonical production schema without legacy aliases.
  -- The first pass above deliberately diverges legacy values to catch regressions;
  -- this second pass removes those legacy columns entirely and reruns the report.
  alter table public.mantigo_financial_ledger
    drop column amount,
    drop column captain_amount;

  v_report := public.get_mantigo_admin_financial_report_backend(v_admin,null,null);
  if (v_report->>'gross')::numeric <> 250
     or (v_report->>'commission')::numeric <> 25
     or (v_report->>'captain_amount')::numeric <> 200 then
    raise exception 'RC523 must execute with canonical columns only: %',v_report;
  end if;
end
$test$;

select 'RC523 canonical MantiGO financial report integration PASS' as result;
