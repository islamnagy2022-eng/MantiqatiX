-- TEST-ONLY overlay for the disposable chronological production-checkpoint replay.
-- Captured Production grants authenticated SELECT on both canonical order resources;
-- anon and PUBLIC do not have SELECT. Re-establish only that SELECT boundary here.
-- This file must NEVER be run against Production.
DO $overlay$
BEGIN
  IF pg_catalog.to_regclass('public.orders') IS NULL
     OR pg_catalog.to_regclass('public.order_status_history') IS NULL THEN
    RAISE EXCEPTION 'ORDER_RESOURCES_ACL_OVERLAY_REQUIRED_TABLE_MISSING';
  END IF;
END
$overlay$;

-- Remove only browser-anonymous/public SELECT. Preserve all other role grants,
-- including service_role's captured privileges and authenticated's read path.
REVOKE SELECT ON TABLE public.orders FROM PUBLIC, anon;
REVOKE SELECT ON TABLE public.order_status_history FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;

DO $verify$
DECLARE
  v_anon_orders_select boolean;
  v_anon_history_select boolean;
BEGIN
  v_anon_orders_select := pg_catalog.has_table_privilege('anon','public.orders','SELECT');
  v_anon_history_select := pg_catalog.has_table_privilege('anon','public.order_status_history','SELECT');

  IF v_anon_orders_select OR v_anon_history_select
     OR NOT pg_catalog.has_table_privilege('authenticated','public.orders','SELECT')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.order_status_history','SELECT') THEN
    RAISE EXCEPTION
      'ORDER_RESOURCES_ACL_OVERLAY_DID_NOT_MATCH_CAPTURED_PRODUCTION_GRANTS: anon_orders_select=%, anon_history_select=%',
      v_anon_orders_select, v_anon_history_select;
  END IF;
END
$verify$;

SELECT 'TEST_ONLY_ORDER_RESOURCES_ANON_SELECT_ACL_OVERLAY=PASS' AS result;
