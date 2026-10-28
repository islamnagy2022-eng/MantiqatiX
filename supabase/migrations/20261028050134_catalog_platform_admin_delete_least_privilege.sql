-- Match the least-privilege deletion contract already applied in production.
-- The Edge Function authenticates the caller and validates an active platform-admin
-- membership before invoking this RPC with the service-role client.
ALTER FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid)
  SECURITY INVOKER;
ALTER FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid)
  SET search_path = '';

REVOKE ALL ON FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mnty_platform_admin_delete_business(text, uuid, uuid)
  TO service_role;

-- Read-only access is limited to the tables checked by the deletion guard.
-- Historical order, payment, agreement, referral and accounting rows are preserved.
GRANT SELECT ON TABLE
  public.orders,
  public.restaurant_orders,
  public.fashion_orders,
  public.erp_purchase_orders,
  public.erp_purchase_receipts,
  public.erp_stock_transfers,
  public.refund_transactions,
  public.subscription_payment_intents,
  public.business_referral_events,
  public.agreements,
  public.inventory_transactions,
  public.journal_entries,
  public.order_status_history,
  public.stock_balances
TO service_role;
