-- RC524 integration contract. Execute only in disposable PostgreSQL after migrations.
do $test$
declare
  v_proc oid;
  v_def text;
  v_config text[];
begin
  select p.oid,p.prosrc,p.proconfig
    into v_proc,v_def,v_config
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='get_mnty_targeted_advertisements'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) =
      'p_country_code character varying, p_governorate_code character varying, p_center_code character varying, p_lat double precision, p_lon double precision, p_ad_space_id character varying, p_limit integer';
  if v_proc is null then raise exception 'RC524 targeted ad function missing'; end if;
  if not exists (select 1 from unnest(coalesce(v_config,'{}'::text[])) c where c = 'search_path=""') then
    raise exception 'RC524 function must have an empty search_path';
  end if;
  if not (select p.prosecdef from pg_catalog.pg_proc p where p.oid=v_proc) then
    raise exception 'RC524 expected SECURITY DEFINER for controlled public ad read';
  end if;
  if not pg_catalog.has_function_privilege('anon',v_proc,'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated',v_proc,'EXECUTE') then
    raise exception 'RC524 public ad-rendering roles lost required execution';
  end if;
  if exists (
    select 1 from pg_catalog.aclexplode(coalesce((select p.proacl from pg_catalog.pg_proc p where p.oid=v_proc),pg_catalog.acldefault('f',(select p.proowner from pg_catalog.pg_proc p where p.oid=v_proc)))) a
    where a.grantee=0 and a.privilege_type='EXECUTE'
  ) then
    raise exception 'RC524 PUBLIC pseudo-role must not have explicit EXECUTE';
  end if;
  if position('public.advertisements' in v_def)=0
     or position('public.advertisement_target_locations' in v_def)=0
     or position('public.platform_geo_areas' in v_def)=0
     or position('public.platform_global_advertisements' in v_def)=0 then
    raise exception 'RC524 all referenced relations must be schema-qualified';
  end if;
end
$test$;
