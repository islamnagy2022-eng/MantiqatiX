-- Disposable-only regression test. Run after the RC449 integration has created and settled ledger-rc449,
-- and after the forward platform-admin migration. RC449 removes this registry row in its revocation test, so restore it here.
DO $test$
DECLARE
  v_admin uuid := '10000000-0000-4000-8000-000000000047';
  v_report jsonb;
BEGIN
  IF (SELECT amount IS NOT NULL OR captain_amount IS NOT NULL
      FROM public.mantigo_financial_ledger WHERE id='ledger-rc449') THEN
    RAISE EXCEPTION 'legacy amount/captain_amount columns must remain unset in this regression fixture';
  END IF;

  INSERT INTO private.platform_admins(user_id) VALUES (v_admin) ON CONFLICT (user_id) DO NOTHING;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_admin::text,false);
  v_report := public.get_mantigo_admin_financial_report_backend(v_admin,NULL,NULL);

  IF (v_report->>'ledger_count')::integer <> 1
     OR (v_report->>'gross')::numeric <> 100
     OR (v_report->>'commission')::numeric <> 10
     OR (v_report->>'captain_amount')::numeric <> 90
     OR (v_report->>'paid_amount')::numeric <> 100
     OR (v_report->>'settled_amount')::numeric <> 90
     OR (v_report->>'unsettled_amount')::numeric <> 0 THEN
    RAISE EXCEPTION 'MantiGO financial report must use the live gross_amount/commission_amount/captain_net_amount columns: %',v_report;
  END IF;

  DELETE FROM private.platform_admins WHERE user_id=v_admin;
END
$test$;

SELECT 'MantiGO financial report live-column regression: PASS' AS result;
