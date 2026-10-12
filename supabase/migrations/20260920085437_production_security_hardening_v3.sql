
begin;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public', r.fn);
  end loop;
end $$;

grant execute on function public.is_platform_admin() to authenticated;

alter table public.refund_transactions enable row level security;
drop policy if exists refund_transactions_finance_select on public.refund_transactions;
create policy refund_transactions_finance_select
on public.refund_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = refund_transactions.tenant_id
      and m.status = 'ACTIVE'
      and upper(m.role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE')
  )
);

alter default privileges for role postgres in schema public
revoke execute on functions from public;

commit;
