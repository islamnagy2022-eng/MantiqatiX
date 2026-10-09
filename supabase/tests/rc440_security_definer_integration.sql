-- RC440 behavioral catalog test; disposable PostgreSQL only.
do $test$
declare
  exposed_config text[];
  private_config text[];
begin
  select p.proconfig into exposed_config from pg_catalog.pg_proc p
  where p.oid='public.rc440_exposed_probe()'::regprocedure;
  if not exists(select 1 from pg_catalog.unnest(exposed_config) cfg where cfg like 'search_path=public, pg_temp%') then
    raise exception 'exposed SECURITY DEFINER function was not hardened';
  end if;
  if pg_catalog.has_function_privilege('anon','public.rc440_exposed_probe()','EXECUTE') is not true then
    raise exception 'fixture exposed function should remain callable by anon';
  end if;

  select p.proconfig into private_config from pg_catalog.pg_proc p
  where p.oid='public.rc440_private_probe()'::regprocedure;
  if not exists(select 1 from pg_catalog.unnest(private_config) cfg where cfg='search_path=public') then
    raise exception 'RC440 must not change service-only function search_path';
  end if;
  if pg_catalog.has_function_privilege('anon','public.rc440_private_probe()','EXECUTE') then
    raise exception 'service-only fixture must not be callable by anon';
  end if;
end;
$test$;

select 'RC440 exposed SECURITY DEFINER search_path integration: PASS' as result;
