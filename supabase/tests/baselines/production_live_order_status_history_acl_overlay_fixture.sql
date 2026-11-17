-- TEST-ONLY overlay for forward replay from the captured Production schema checkpoint.
-- Production currently grants authenticated SELECT only on order_status_history.
-- This file must run only against the disposable local Supabase replay database.
DO $overlay$
BEGIN
  IF pg_catalog.to_regclass('public.order_status_history') IS NULL THEN
    RAISE EXCEPTION 'ORDER_HISTORY_ACL_OVERLAY_TABLE_MISSING';
  END IF;
END
$overlay$;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.order_status_history
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.order_status_history TO authenticated;

DO $verify$
BEGIN
  IF pg_catalog.has_table_privilege('anon','public.order_status_history','SELECT')
     OR pg_catalog.has_table_privilege('anon','public.order_status_history','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.order_status_history','INSERT')
     OR pg_catalog.has_table_privilege('authenticated','public.order_status_history','UPDATE')
     OR pg_catalog.has_table_privilege('authenticated','public.order_status_history','DELETE')
     OR NOT pg_catalog.has_table_privilege('authenticated','public.order_status_history','SELECT') THEN
    RAISE EXCEPTION 'ORDER_HISTORY_ACL_OVERLAY_DID_NOT_MATCH_LIVE_READ_ONLY_GRANTS';
  END IF;
END
$verify$;

SELECT 'TEST_ONLY_ORDER_STATUS_HISTORY_READ_ONLY_ACL_OVERLAY=PASS' AS result;
