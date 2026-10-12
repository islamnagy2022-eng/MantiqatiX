revoke references, trigger, truncate on all tables in schema public from anon;
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.trg_enforce_journal_entry_immutability() from anon;
revoke execute on function public.trg_enforce_journal_line_immutability() from anon;
revoke execute on function public.trg_enforce_wallet_balance_integrity() from anon;
revoke execute on function public.trg_post_journal_to_general_ledger() from anon;
revoke execute on function public.trg_validate_journal_entry_balance() from anon;
revoke execute on function public.validate_journal_entry_balance() from anon;
