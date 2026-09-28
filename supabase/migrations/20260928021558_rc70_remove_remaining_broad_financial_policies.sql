do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in (
        'businesses','commission_transactions','financial_obligations','general_ledger',
        'journal_entries','journal_entry_lines','payment_events',
        'settlement_attempts','settlement_transactions','wallet_accounts','wallet_transactions'
      )
      and cmd='ALL'
      and (
        qual like '%auth.jwt()%is_anonymous%'
        or with_check like '%auth.jwt()%is_anonymous%'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
