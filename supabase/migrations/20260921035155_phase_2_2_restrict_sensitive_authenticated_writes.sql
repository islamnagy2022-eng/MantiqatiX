REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
 public.audit_logs, public.commission_transactions, public.general_ledger,
 public.journal_entries, public.journal_entry_lines, public.order_status_history,
 public.payment_events, public.payment_provider_events, public.settlement_transactions,
 public.wallet_accounts, public.wallet_transactions, public.sync_logs
FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
 public.tenants, public.organizations, public.user_memberships, public.businesses,
 public.branches, public.business_modules, public.business_sectors, public.business_categories,
 public.modules, public.tenant_modules, public.chart_of_accounts, public.commission_rules,
 public.stock_balances, public.inventory_transactions, public.warehouses
FROM authenticated;
