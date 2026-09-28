-- RC70: remove broad authenticated ALL policies from high-risk surfaces.
do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'orders','payment_intents','payment_provider_events','payment_events',
    'payment_financial_reconciliations','financial_obligations','general_ledger',
    'journal_entries','journal_entry_lines','commission_transactions','wallet_accounts',
    'wallet_transactions','settlement_transactions','settlement_attempts',
    'refund_transactions','subscription_payment_intents','businesses'
  ] loop
    foreach p in array array[
      'authenticated_sessions_only','mnt_non_anonymous_boundary',
      'non_anonymous_authenticated_guard','non_anonymous_authenticated_only'
    ] loop
      execute format('drop policy if exists %I on public.%I', p, t);
    end loop;
  end loop;
end $$;
