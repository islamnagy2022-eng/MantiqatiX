-- RC116 structural contract: business and subscriber management must be guarded and auditable.
do $$
begin
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_list_businesses' and p.prosecdef) then
    raise exception 'RC116 business list must be SECURITY DEFINER';
  end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_manage_business' and p.prosecdef) then
    raise exception 'RC116 business manager must be SECURITY DEFINER';
  end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_manage_membership' and p.prosecdef) then
    raise exception 'RC116 membership manager must be SECURITY DEFINER';
  end if;
  if has_function_privilege('anon','public.mnty_platform_admin_list_businesses(text)','EXECUTE')
     or has_function_privilege('anon','public.mnty_platform_admin_manage_business(uuid,text,jsonb,text)','EXECUTE')
     or has_function_privilege('anon','public.mnty_platform_admin_manage_membership(uuid,text,text)','EXECUTE') then
    raise exception 'RC116 administrative RPCs must not be executable by anon';
  end if;
end $$;
