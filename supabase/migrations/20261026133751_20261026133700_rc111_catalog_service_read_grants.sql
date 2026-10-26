-- Read-only grants required by the trusted catalog-admin Edge Function.
-- Keep privileges scoped to service_role; do not grant these tables to anon/authenticated.
GRANT SELECT ON TABLE public.catalog_items TO service_role;
GRANT SELECT ON TABLE public.catalog_item_prices TO service_role;
GRANT SELECT ON TABLE public.catalog_item_options TO service_role;
