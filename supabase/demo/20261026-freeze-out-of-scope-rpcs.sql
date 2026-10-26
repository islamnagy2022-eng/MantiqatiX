-- DEMO-only scope freeze: these shared RPCs belong to non-DEMO modules.
-- The connected four-sector UI does not call them and no public RLS policy references them.
-- Keep them available only to the trusted server role in DEMO; do not apply to LIVE.

REVOKE ALL ON FUNCTION public.accept_mantigo_bid_backend(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_mantigo_bid_backend(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.admin_create_global_ad(character varying, text, text, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_global_ad(character varying, text, text, timestamp with time zone, timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.create_education_request_backend(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_education_request_backend(uuid, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_indrive_bid_backend(uuid, uuid, text, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_indrive_bid_backend(uuid, uuid, text, text, numeric, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_indrive_request_backend(uuid, text, text, text, text, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_indrive_request_backend(uuid, text, text, text, text, numeric, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_job_backend(uuid, text, character varying, uuid, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_job_backend(uuid, text, character varying, uuid, text, text, text, text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_mantigo_bid_backend(uuid, text, text, text, numeric, text, text, text, numeric, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mantigo_bid_backend(uuid, text, text, text, numeric, text, text, text, numeric, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_mantigo_ride_backend(uuid, text, text, text, text, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mantigo_ride_backend(uuid, text, text, text, text, text, text, numeric, text) TO service_role;

REVOKE ALL ON FUNCTION public.create_mantigo_ride_backend_v2(uuid, text, text, text, text, text, text, numeric, text, text, double precision, double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_mantigo_ride_backend_v2(uuid, text, text, text, text, text, text, numeric, text, text, double precision, double precision, double precision, double precision) TO service_role;

REVOKE ALL ON FUNCTION public.expire_stale_mantigo_rides_backend(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_mantigo_rides_backend(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.fulfill_digital_page_publish(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_digital_page_publish(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_mantigo_admin_dashboard_backend(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mantigo_admin_dashboard_backend(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mantigo_captain_earnings_backend(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_mantigo_captain_rides_backend(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_mantigo_captain_rides_backend(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.list_mantigo_customer_rides_backend(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_mantigo_customer_rides_backend(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.list_open_mantigo_rides_backend(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_open_mantigo_rides_backend(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.lock_mantigo_fare_backend(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_mantigo_fare_backend(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.mantigo_rate_ride(text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mantigo_rate_ride(text, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.mark_notifications_read_backend(character varying) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read_backend(character varying) TO service_role;

REVOKE ALL ON FUNCTION public.match_mantigo_ride_backend(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_mantigo_ride_backend(uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.review_mantigo_captain_application(uuid, uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_mantigo_captain_application(uuid, uuid, text, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.submit_job_application_backend(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_job_application_backend(uuid, uuid, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.submit_mantigo_captain_application(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_mantigo_captain_application(uuid, text, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.update_mantigo_captain_presence_backend(uuid, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_mantigo_captain_presence_backend(uuid, text, double precision, double precision) TO service_role;

REVOKE ALL ON FUNCTION public.update_mantigo_trip_status_backend(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_mantigo_trip_status_backend(uuid, text, text, text) TO service_role;
