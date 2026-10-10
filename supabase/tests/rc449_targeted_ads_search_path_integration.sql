-- RC449 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  v_oid oid;
  v_config text;
  v_public_execute boolean;
begin
  v_oid := to_regprocedure('public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)');
  if v_oid is null then
    raise exception 'RC449_TARGETED_ADS_FUNCTION_MISSING';
  end if;

  select coalesce(array_to_string(p.proconfig, ','), '')
    into v_config
  from pg_proc p
  where p.oid = v_oid;

  if v_config not in ('search_path=""', 'search_path=') then
    raise exception 'RC449_EMPTY_SEARCH_PATH_NOT_APPLIED:%', v_config;
  end if;

  if not has_function_privilege('anon', v_oid, 'EXECUTE')
     or not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'RC449_INTENDED_PUBLIC_DISCOVERY_GRANTS_CHANGED';
  end if;

  select exists (
    select 1
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) into v_public_execute
  from pg_proc p where p.oid = v_oid;

  if v_public_execute then
    raise exception 'RC449_UNEXPECTED_PUBLIC_ROLE_EXECUTE';
  end if;
end;
$test$;

select 'RC449 targeted ads empty search_path integration: PASS' as result;
