-- Keep the platform-admin deletion RPC invoker-safe. The Edge Function authenticates
-- the user, checks active SUPER_ADMIN membership, and scopes the business/tenant first.
-- Grant the server-only service_role only the table privileges this RPC actually needs.
ALTER FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) SET search_path = '';

REVOKE ALL ON FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid) TO service_role;

GRANT SELECT ON
  public.orders,
  public.restaurant_orders,
  public.fashion_orders,
  public.erp_purchase_orders,
  public.erp_purchase_receipts,
  public.erp_stock_transfers,
  public.refund_transactions,
  public.subscription_payment_intents,
  public.business_referral_events,
  public.agreements
TO service_role;

GRANT SELECT, DELETE ON
  public.restaurant_inventory,
  public.restaurant_menu_items,
  public.restaurant_tables,
  public.fashion_products,
  public.catalog_business_settings
TO service_role;

GRANT DELETE ON
  public.catalog_items,
  public.marketing_provider_profiles
TO service_role;
