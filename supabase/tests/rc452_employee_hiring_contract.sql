-- RC452 structural contract. Run against isolated CI DB after migrations.
do $$
begin
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='business_job_positions' and c.relrowsecurity and c.relforcerowsecurity) then raise exception 'RC452 job positions must FORCE RLS'; end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='business_employees' and c.relrowsecurity and c.relforcerowsecurity) then raise exception 'RC452 employees must FORCE RLS'; end if;
  if has_table_privilege('anon','public.business_employees','SELECT') or has_table_privilege('authenticated','public.business_employees','UPDATE') then raise exception 'RC452 employee data must not be directly accessible from browser'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='mnty_business_employee_upsert' and p.prosecdef) then raise exception 'RC452 employee upsert must be guarded server-side'; end if;
end $$;
