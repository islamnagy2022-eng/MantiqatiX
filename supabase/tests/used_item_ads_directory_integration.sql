-- Behavioral tests for the narrow used-item directory RPC; disposable PostgreSQL only.
do $test$
declare
  owner_a constant uuid := '10000000-0000-4000-8000-000000000001';
  owner_b constant uuid := '10000000-0000-4000-8000-000000000002';
  biz_a constant uuid := '20000000-0000-4000-8000-000000000001';
  result_count integer;
  rejected boolean;
begin
  insert into public.used_item_ads(id,owner_user_id,tenant_id,business_id,title,description,category,price,seller_name,seller_phone,image_url,fee_paid,location,is_sold,created_at)
  values
   ('30000000-0000-4000-8000-000000000001',owner_a,'tenant-a',biz_a,'Active A','desc','tools',10,'Seller A','111111','https://example.test/a.png',0,'Tanta',false,now()),
   ('30000000-0000-4000-8000-000000000002',owner_a,'tenant-a',biz_a,'Sold A','desc','tools',20,'Seller A','111111','https://example.test/b.png',0,'Tanta',true,now()-interval '1 minute'),
   ('30000000-0000-4000-8000-000000000003',owner_b,'tenant-a',biz_a,'Sold B','desc','tools',30,'Seller B','222222','https://example.test/c.png',0,'Tanta',true,now()),
   ('30000000-0000-4000-8000-000000000004',owner_b,'tenant-b',null,'Active B','desc','tools',40,'Seller B','222222','https://example.test/d.png',0,'Cairo',false,now());

  perform set_config('request.jwt.claim.sub',owner_a::text,false);
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);

  select count(*) into result_count from public.list_used_item_ads_backend(null,null);
  if result_count <> 3 then raise exception 'expected 2 active ads plus caller-owned sold ad, got %',result_count; end if;

  select count(*) into result_count from public.list_used_item_ads_backend('tenant-a',biz_a);
  if result_count <> 2 then raise exception 'tenant/business filters should return active A plus owner sold A, got %',result_count; end if;

  if exists(select 1 from public.list_used_item_ads_backend(null,null) where title='Sold B') then
    raise exception 'sold listing owned by another user leaked into directory';
  end if;

  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='used_item_ads' and column_name='seller_phone'
            and has_column_privilege('authenticated','public.used_item_ads','seller_phone','SELECT')) then
    raise exception 'authenticated role can read seller_phone';
  end if;
  if has_table_privilege('authenticated','public.used_item_ads','SELECT') then
    raise exception 'authenticated role retains table-wide SELECT';
  end if;
  if has_column_privilege('authenticated','public.used_item_ads','owner_user_id','SELECT') then
    raise exception 'authenticated role can read owner_user_id directly';
  end if;
  if has_function_privilege('anon','public.list_used_item_ads_backend(varchar,uuid)','EXECUTE') then
    raise exception 'anon must not execute directory RPC';
  end if;
  if not has_function_privilege('authenticated','public.list_used_item_ads_backend(varchar,uuid)','EXECUTE') then
    raise exception 'authenticated must execute directory RPC';
  end if;

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}',false);
  rejected := false;
  begin
    perform * from public.list_used_item_ads_backend(null,null);
  exception when sqlstate '42501' then
    rejected := true;
  end;
  if not rejected then raise exception 'anonymous auth session was not rejected'; end if;

  perform set_config('request.jwt.claim.sub','',false);
  perform set_config('request.jwt.claims','{"role":"anon"}',false);
  rejected := false;
  begin
    perform * from public.list_used_item_ads_backend(null,null);
  exception when sqlstate '42501' then
    rejected := true;
  end;
  if not rejected then raise exception 'unauthenticated session was not rejected'; end if;
end
$test$;
