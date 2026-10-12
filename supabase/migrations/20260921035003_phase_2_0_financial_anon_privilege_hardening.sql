REVOKE ALL ON TABLE
  public.commission_transactions,
  public.general_ledger,
  public.journal_entries,
  public.journal_entry_lines,
  public.payment_intents,
  public.payment_events,
  public.payment_provider_events,
  public.financial_obligations,
  public.settlement_transactions,
  public.settlement_attempts,
  public.wallet_accounts,
  public.wallet_transactions,
  public.payout_destinations
FROM anon;

REVOKE ALL ON TABLE
  public.orders,
  public.catalog_items,
  public.catalog_item_options,
  public.catalog_item_prices,
  public.catalog_business_settings
FROM anon;
