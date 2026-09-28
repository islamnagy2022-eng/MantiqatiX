-- RC151: converge backend-only ERP/SMM table privileges with production fail-closed contract.
-- These tables are intentionally backend/service-role only; ordinary client roles must not
-- receive direct table DML because the backend authority functions enforce business scope.
revoke all on table public.erp_purchase_orders from anon, authenticated;
revoke all on table public.erp_purchase_receipts from anon, authenticated;
revoke all on table public.erp_stock_transfers from anon, authenticated;

revoke all on table public.smm_admins from anon, authenticated;
revoke all on table public.smm_provider_credentials from anon, authenticated;
revoke all on table public.smm_providers from anon, authenticated;
