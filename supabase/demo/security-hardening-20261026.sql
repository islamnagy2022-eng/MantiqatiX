-- DEMO-only least-privilege hardening for browser-accessible database APIs.
-- Apply ONLY to MantiqatiX-DEMO. Never apply this file to LIVE.
-- Core connected DEMO flows use the dedicated demo Edge Functions. These unrelated
-- backend APIs are outside the four-sector demo workflow and must remain server-only.

revoke all privileges on table public.digital_page_payment_events from public, anon, authenticated;
revoke all privileges on table public.mantigo_payment_provider_events from public, anon, authenticated;

do $demo$
declare
  r record;
  signature text;
begin
  for r in
    select n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes) as arg_types
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'create_purchase_order_backend',
        'create_stock_transfer_backend',
        'deactivate_business',
        'get_or_create_business_referral_profile',
        'initialize_opening_stock_backend',
        'receive_purchase_stock_backend',
        'receive_stock_transfer_backend',
        'track_business_referral_event',
        'update_medical_appointment_status_backend',
        'update_purchase_order_status_backend',
        'update_stock_transfer_status_backend',
        'upsert_catalog_settings_backend'
      )
  loop
    signature := pg_catalog.format('%I.%I(%s)', r.nspname, r.proname, r.arg_types);
    execute 'REVOKE ALL ON FUNCTION ' || signature || ' FROM PUBLIC, anon, authenticated';
    execute 'GRANT EXECUTE ON FUNCTION ' || signature || ' TO service_role';
  end loop;
end;
$demo$;

-- Clinic booking uses this RPC with the authenticated user's JWT. Keep it
-- callable only by authenticated sessions and the trusted backend role.
revoke all on function public.create_medical_appointment_backend(uuid, text, uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_medical_appointment_backend(uuid, text, uuid, text, bigint, text)
  to authenticated, service_role;
