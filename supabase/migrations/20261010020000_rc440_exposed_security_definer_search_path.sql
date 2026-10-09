-- RC440: prevent pg_temp objects from shadowing public objects in exposed SECURITY DEFINER functions.
-- Scope is limited to public-schema SECURITY DEFINER functions executable by anon/authenticated
-- whose current function-level search_path is exactly public.
do $rc440$
declare
  fn record;
  changed_count integer := 0;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and exists(select 1 from pg_catalog.unnest(p.proconfig) as cfg where cfg='search_path=public')
      and (
        pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      )
  loop
    execute pg_catalog.format('alter function %s set search_path = public, pg_temp',fn.signature);
    changed_count:=changed_count+1;
  end loop;
  raise notice 'RC440 fixed search_path for % exposed SECURITY DEFINER functions',changed_count;
end;
$rc440$;
