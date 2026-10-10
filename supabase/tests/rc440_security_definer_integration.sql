-- RC440 behavioral catalog and temp-schema shadowing test; disposable PostgreSQL only.
create temporary table rc440_guarded_data(value integer not null);
insert into pg_temp.rc440_guarded_data(value) values (99);

do $test$
declare
  exposed_config text[];
  authenticated_config text[];
  already_hardened_config text[];
  private_config text[];
  probe_result integer;
begin
  select p.proconfig into exposed_config from pg_catalog.pg_proc p
  where p.oid='public.rc440_exposed_probe()'::regprocedure;
  if not exists(select 1 from pg_catalog.unnest(exposed_config) cfg where cfg like 'search_path=public, pg_temp%') then
    raise exception 'anon-exposed SECURITY DEFINER function was not hardened';
  end if;
  if pg_catalog.has_function_privilege('anon','public.rc440_exposed_probe()','EXECUTE') is not true then
    raise exception 'fixture exposed function should remain callable by anon; RC440 must not alter grants';
  end if;

  -- A same-named temporary table must not shadow the public object inside SECURITY DEFINER.
  select public.rc440_exposed_probe() into probe_result;
  if probe_result <> 10 then
    raise exception 'temporary-schema shadowing was not prevented; expected public value 10, got %',probe_result;
  end if;

  select p.proconfig into authenticated_config from pg_catalog.pg_proc p
  where p.oid='public.rc440_authenticated_probe()'::regprocedure;
  if not exists(select 1 from pg_catalog.unnest(authenticated_config) cfg where cfg like 'search_path=public, pg_temp%') then
    raise exception 'authenticated-exposed SECURITY DEFINER function was not hardened';
  end if;
  if pg_catalog.has_function_privilege('authenticated','public.rc440_authenticated_probe()','EXECUTE') is not true then
    raise exception 'fixture authenticated function should remain callable by authenticated; RC440 must not alter grants';
  end if;

  select p.proconfig into already_hardened_config from pg_catalog.pg_proc p
  where p.oid='public.rc440_already_hardened_probe()'::regprocedure;
  if not exists(select 1 from pg_catalog.unnest(already_hardened_config) cfg where cfg='search_path=public, pg_temp') then
    raise exception 'RC440 unexpectedly changed an already-hardened function';
  end if;

  select p.proconfig into private_config from pg_catalog.pg_proc p
  where p.oid='public.rc440_private_probe()'::regprocedure;
  if not exists(select 1 from pg_catalog.unnest(private_config) cfg where cfg='search_path=public') then
    raise exception 'RC440 must not change service-only function search_path';
  end if;
  if pg_catalog.has_function_privilege('anon','public.rc440_private_probe()','EXECUTE') then
    raise exception 'service-only fixture must not be callable by anon';
  end if;
  if pg_catalog.has_function_privilege('authenticated','public.rc440_private_probe()','EXECUTE') then
    raise exception 'service-only fixture must not be callable by authenticated';
  end if;
end;
$test$;

select 'RC440 exposed SECURITY DEFINER search_path integration: PASS' as result;
