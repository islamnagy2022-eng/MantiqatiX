-- RC115 structural contract for guarded platform control center RPCs.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_has_permission' and p.prosecdef
  ) then raise exception 'RC115 scoped permission resolver must be SECURITY DEFINER'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_list_people' and p.prosecdef
  ) then raise exception 'RC115 user directory must be guarded server-side'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_list_role_assignments' and p.prosecdef
  ) then raise exception 'RC115 role assignments listing must be guarded server-side'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_list_audit' and p.prosecdef
  ) then raise exception 'RC115 audit feed must be guarded server-side'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_business_employee_list' and p.prosecdef
  ) then raise exception 'RC115 employee list must be guarded server-side'; end if;
  if has_table_privilege('anon','public.business_employees','SELECT')
     or has_table_privilege('authenticated','public.business_employees','SELECT')
     or has_table_privilege('authenticated','public.platform_role_assignments','SELECT') then
    raise exception 'RC115 browser roles must not read private admin/employee tables directly';
  end if;
  if has_function_privilege('anon','public.mnty_platform_admin_list_people(text)','EXECUTE')
     or has_function_privilege('anon','public.mnty_platform_admin_list_audit(text)','EXECUTE') then
    raise exception 'RC115 administrative list RPCs must not be executable by anon';
  end if;
end $$;
