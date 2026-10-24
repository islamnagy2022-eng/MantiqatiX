-- RC458 behavioral integration test. Run only in disposable PostgreSQL.
-- The shared RC453 fixture models memberships and provider profiles; the campaign migration
-- supplies the authoritative manager-scope helper used by the directory.
alter table public.marketing_provider_profiles add column name_en text;
update public.marketing_provider_profiles
set name_en = case slug
  when 'partner-b' then 'Verified Partner B English'
  when 'partner-unverified' then 'Unverified Partner'
  when 'freelancer-c' then 'Verified Freelancer C'
  else name_ar
end;
insert into public.marketing_provider_profiles
  (id,business_id,owner_user_id,provider_kind,name_ar,name_en,slug,status,is_verified)
values
  ('40000000-0000-4000-8000-000000000004',
   '30000000-0000-4000-8000-000000000001',
   '30000000-0000-4000-8000-000000000019',
   'PARTNER_COMPANY','Own Business Partner','Own Business Partner','own-business-partner','ACTIVE',true);

set role authenticated;
do $test$
declare
  manager_a uuid := '30000000-0000-4000-8000-000000000011';
  manager_b uuid := '30000000-0000-4000-8000-000000000012';
  business_a uuid := '30000000-0000-4000-8000-000000000001';
  business_b uuid := '30000000-0000-4000-8000-000000000002';
  result_count integer;
  result_ids uuid[];
  rejected boolean;
begin
  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  perform set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',manager_a::text,'is_anonymous',false)::text,false);

  select count(*),array_agg(id order by id)
    into result_count,result_ids
  from public.list_marketing_partner_directory_backend(manager_a,business_a,null,50);

  if result_count <> 2
     or not ('40000000-0000-4000-8000-000000000001'::uuid = any(result_ids))
     or not ('40000000-0000-4000-8000-000000000003'::uuid = any(result_ids)) then
    raise exception 'directory must return only the two active, verified, eligible cross-business profiles; got % rows',result_count;
  end if;
  if '40000000-0000-4000-8000-000000000002'::uuid = any(result_ids) then
    raise exception 'unverified profile leaked into directory';
  end if;
  if '40000000-0000-4000-8000-000000000004'::uuid = any(result_ids) then
    raise exception 'same-business profile leaked into directory';
  end if;

  select count(*) into result_count
  from public.list_marketing_partner_directory_backend(manager_a,business_a,'Freelancer',50);
  if result_count <> 1 then raise exception 'search did not restrict the directory to matching profile'; end if;

  select count(*) into result_count
  from public.list_marketing_partner_directory_backend(manager_a,business_a,null,1);
  if result_count <> 1 then raise exception 'caller result limit was not respected'; end if;

  rejected := false;
  begin
    perform * from public.list_marketing_partner_directory_backend(manager_b,business_a,null,50);
  exception when others then
    if sqlerrm='ACTOR_MISMATCH' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'actor spoofing was accepted'; end if;

  perform set_config('request.jwt.claim.sub',manager_b::text,false);
  rejected := false;
  begin
    perform * from public.list_marketing_partner_directory_backend(manager_b,business_a,null,50);
  exception when others then
    if sqlerrm='MARKETING_BUSINESS_SCOPE_REQUIRED' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'manager from business B accessed business A directory'; end if;

  perform set_config('request.jwt.claim.sub',manager_a::text,false);
  rejected := false;
  begin
    perform * from public.list_marketing_partner_directory_backend(manager_a,business_a,repeat('x',81),50);
  exception when others then
    if sqlerrm='MARKETING_PARTNER_SEARCH_TOO_LONG' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'overlong search term was accepted'; end if;

  if has_function_privilege('anon','public.list_marketing_partner_directory_backend(uuid,uuid,text,integer)','EXECUTE') then
    raise exception 'anon can execute partner directory RPC';
  end if;
  if not has_function_privilege('authenticated','public.list_marketing_partner_directory_backend(uuid,uuid,text,integer)','EXECUTE') then
    raise exception 'authenticated cannot execute partner directory RPC';
  end if;
end;
$test$;
reset role;
select 'RC458 scoped marketing partner directory integration: PASS' as result;
