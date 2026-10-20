-- Behavioral and privilege tests for the used-item directory read RPC.
-- Run only against the disposable PostgreSQL fixture.
do $contract$
declare
  v_oid oid;
  v_result text;
  v_config text;
begin
  v_oid := to_regprocedure('public.list_used_item_ads_backend(character varying,uuid)');
  if v_oid is null then
    raise exception 'USED_ITEM_DIRECTORY_RPC_MISSING';
  end if;

  select pg_catalog.pg_get_function_result(v_oid) into v_result;
  if v_result ilike '%seller_phone%' then
    raise exception 'USED_ITEM_DIRECTORY_RPC_EXPOSES_SELLER_PHONE';
  end if;

  select pg_catalog.array_to_string(p.proconfig, ',') into v_config
  from pg_catalog.pg_proc p where p.oid = v_oid;
  if v_config not like '%search_path=pg_catalog, public%' then
    raise exception 'USED_ITEM_DIRECTORY_RPC_UNSAFE_SEARCH_PATH:%', v_config;
  end if;

  if has_function_privilege('anon', v_oid, 'EXECUTE') then
    raise exception 'ANON_CAN_EXECUTE_USED_ITEM_DIRECTORY_RPC';
  end if;
  if not has_function_privilege('authenticated', v_oid, 'EXECUTE') then
    raise exception 'AUTHENTICATED_CANNOT_EXECUTE_USED_ITEM_DIRECTORY_RPC';
  end if;

  if has_table_privilege('anon','public.used_item_ads','SELECT')
     or has_table_privilege('authenticated','public.used_item_ads','SELECT')
     or has_table_privilege('authenticated','public.used_item_ads','INSERT')
     or has_table_privilege('authenticated','public.used_item_ads','UPDATE')
     or has_table_privilege('authenticated','public.used_item_ads','DELETE') then
    raise exception 'DIRECT_CLIENT_TABLE_PRIVILEGE_REMAINS';
  end if;
end;
$contract$;

insert into public.used_item_ads(
  id, owner_user_id, tenant_id, business_id, title, category, price,
  seller_name, seller_phone, location, is_sold, created_at
) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','Active A','Electronics',100,'Seller A','01000000001','Cairo',false,now()-interval '4 minutes'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','Own sold B','Furniture',200,'Seller B','01000000002','Giza',true,now()-interval '3 minutes'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','Other sold C','Books',300,'Seller C','01000000003','Tanta',true,now()-interval '2 minutes'),
  ('40000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000002','tenant-b','20000000-0000-4000-8000-000000000002','Active D','Appliances',400,'Seller D','01000000004','Alexandria',false,now()-interval '1 minute');

-- Missing auth identity must be rejected, not treated as an empty result.
set role authenticated;
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $no_identity$
begin
  begin
    perform * from public.list_used_item_ads_backend(null,null);
    raise exception 'TEST_FAILED: missing identity was accepted';
  exception when sqlstate '42501' then
    null;
  end;
end;
$no_identity$;
reset role;

-- Anonymous Auth sessions must also be rejected even with a UUID subject.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":true}',false);
do $anonymous$
begin
  begin
    perform * from public.list_used_item_ads_backend(null,null);
    raise exception 'TEST_FAILED: anonymous auth session was accepted';
  exception when sqlstate '42501' then
    null;
  end;
end;
$anonymous$;
reset role;

-- A verified user sees active listings and their own sold listing only.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $scope$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.list_used_item_ads_backend('tenant-a','20000000-0000-4000-8000-000000000001');
  if v_count <> 2 then
    raise exception 'USED_ITEM_SCOPE_EXPECTED_2_GOT_%', v_count;
  end if;
  if exists(select 1 from public.list_used_item_ads_backend('tenant-a','20000000-0000-4000-8000-000000000001') where title='Other sold C') then
    raise exception 'OTHER_USERS_SOLD_LISTING_EXPOSED';
  end if;
  if not exists(select 1 from public.list_used_item_ads_backend('tenant-a','20000000-0000-4000-8000-000000000001') where title='Own sold B') then
    raise exception 'OWNER_CANNOT_SEE_OWN_SOLD_LISTING';
  end if;
  if exists(select 1 from public.list_used_item_ads_backend('tenant-a','20000000-0000-4000-8000-000000000001') where title='Active D') then
    raise exception 'TENANT_BUSINESS_FILTER_NOT_APPLIED';
  end if;
  select count(*) into v_count from public.list_used_item_ads_backend(null,null);
  if v_count <> 3 then
    raise exception 'GLOBAL_DIRECTORY_EXPECTED_3_GOT_%', v_count;
  end if;
end;
$scope$;
reset role;

select 'used-item directory read RPC integration: PASS' as result;
