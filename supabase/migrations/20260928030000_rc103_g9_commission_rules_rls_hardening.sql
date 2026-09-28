-- RC103 G9: remove legacy broad ALL policies from commission_rules.
drop policy if exists authenticated_sessions_only on public.commission_rules;
drop policy if exists deny_anonymous_users on public.commission_rules;
drop policy if exists mnt_non_anonymous_boundary on public.commission_rules;
drop policy if exists non_anonymous_authenticated_guard on public.commission_rules;
