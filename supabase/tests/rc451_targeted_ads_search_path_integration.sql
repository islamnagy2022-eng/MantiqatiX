-- RC451 targeted-ad public-read contract integration test. Disposable PostgreSQL only.
do $test$
declare
  v_oid oid;
  v_config text;
  v_public_execute boolean;
  v_count integer;
  v_ids text[];
  v_level text;
  v_limit_count integer;
begin
  v_oid := to_regprocedure('public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)');
  if v_oid is null then raise exception 'RC451_TARGETED_ADS_FUNCTION_MISSING'; end if;

  select coalesce(array_to_string(p.proconfig, ','), '') into v_config
  from pg_proc p where p.oid=v_oid;
  if v_config not in ('search_path=""','search_path=') then
    raise exception 'RC451_EMPTY_SEARCH_PATH_NOT_APPLIED:%',v_config;
  end if;

  if not has_function_privilege('anon',v_oid,'EXECUTE')
     or not has_function_privilege('authenticated',v_oid,'EXECUTE') then
    raise exception 'RC451_INTENDED_PUBLIC_DISCOVERY_GRANTS_CHANGED';
  end if;

  select exists (
    select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    where a.grantee=0 and a.privilege_type='EXECUTE'
  ) into v_public_execute from pg_proc p where p.oid=v_oid;
  if v_public_execute then raise exception 'RC451_UNEXPECTED_PUBLIC_ROLE_EXECUTE'; end if;

  if pg_get_function_result(v_oid) <>
     'TABLE(advertisement_id character varying, title character varying, creative_url text, target_url text, ad_space_id character varying, match_level character varying, distance_km double precision)' then
    raise exception 'RC451_PUBLIC_OUTPUT_PROJECTION_DRIFT:%',pg_get_function_result(v_oid);
  end if;

  select count(*),array_agg(advertisement_id order by advertisement_id)
    into v_count,v_ids
  from public.get_mnty_targeted_advertisements('EG','17','1701',30.6440,30.6940,'HOME_SPONSORED',50);
  if v_count<>3 then raise exception 'RC451_EXPECTED_THREE_APPROVED_ACTIVE_HOME_SPONSORED_ADS:%',v_count; end if;
  if not (v_ids @> array['ad-center','ad-governorate','GLOBAL-00000000-0000-4000-8000-000000000101']::text[]) then
    raise exception 'RC451_EXPECTED_PUBLIC_AD_IDS_MISSING:%',v_ids;
  end if;
  if v_ids && array['ad-inactive','ad-pending','ad-expired','ad-future','ad-other-space',
      'GLOBAL-00000000-0000-4000-8000-000000000102','GLOBAL-00000000-0000-4000-8000-000000000103',
      'GLOBAL-00000000-0000-4000-8000-000000000104','GLOBAL-00000000-0000-4000-8000-000000000105',
      'GLOBAL-00000000-0000-4000-8000-000000000106']::text[] then
    raise exception 'RC451_INACTIVE_UNAPPROVED_OUT_OF_WINDOW_OR_WRONG_PLACEMENT_AD_LEAKED:%',v_ids;
  end if;

  select match_level into v_level
  from public.get_mnty_targeted_advertisements('EG','17','1701',30.6440,30.6940,'HOME_SPONSORED',50)
  where advertisement_id='ad-center';
  if v_level<>'CENTER' then raise exception 'RC451_BEST_GEOGRAPHIC_MATCH_NOT_SELECTED:%',v_level; end if;

  select count(*) into v_limit_count
  from public.get_mnty_targeted_advertisements('EG',null,null,null,null,'LIMIT_TEST',999);
  if v_limit_count<>50 then raise exception 'RC451_LIMIT_UPPER_BOUND_FAILED:%',v_limit_count; end if;

  select count(*) into v_limit_count
  from public.get_mnty_targeted_advertisements('EG',null,null,null,null,'LIMIT_TEST',0);
  if v_limit_count<>1 then raise exception 'RC451_LIMIT_LOWER_BOUND_FAILED:%',v_limit_count; end if;

  select count(*) into v_limit_count
  from public.get_mnty_targeted_advertisements('EG',null,null,null,null,'LIMIT_TEST',null);
  if v_limit_count<>3 then raise exception 'RC451_NULL_LIMIT_DEFAULT_FAILED:%',v_limit_count; end if;
end;
$test$;

select 'RC451 targeted ads empty search_path integration: PASS (public output contract)' as result;
