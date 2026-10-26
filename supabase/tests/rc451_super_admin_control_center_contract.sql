-- RC451 structural contract: run in an isolated CI database after migrations.
do $$
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='platform_custom_roles' and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'RC451 custom roles must have FORCE RLS'; end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='platform_role_assignments' and c.relrowsecurity and c.relforcerowsecurity
  ) then raise exception 'RC451 assignments must have FORCE RLS'; end if;
  if has_table_privilege('anon','public.platform_custom_roles','SELECT')
     or has_table_privilege('authenticated','public.platform_custom_roles','SELECT')
     or has_table_privilege('anon','public.platform_role_assignments','INSERT')
     or has_table_privilege('authenticated','public.platform_role_assignments','UPDATE') then
    raise exception 'RC451 browser roles must not access administrative tables directly';
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_upsert_custom_role'
      and p.prosecdef
  ) then raise exception 'RC451 role upsert must use SECURITY DEFINER RPC'; end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='mnty_platform_admin_assign_custom_role'
      and p.prosecdef
  ) then raise exception 'RC451 role assignment must use SECURITY DEFINER RPC'; end if;
end $$;
