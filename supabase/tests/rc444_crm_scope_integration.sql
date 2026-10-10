-- RC444 RLS tests run as authenticated role against disposable PostgreSQL.
insert into public.user_memberships(id,user_id,tenant_id,business_id,role,status,permissions) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TENANT-A','30000000-0000-4000-8000-000000000001','MANAGER','ACTIVE','{}'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','TENANT-B','30000000-0000-4000-8000-000000000002','OWNER','ACTIVE','{}'),
 ('10000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','MNTY-PLATFORM',null,'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}');

insert into public.marketing_leads(id,requester_user_id,requester_business_id,title,status) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','Lead A','NEW'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Lead B','NEW'),
 ('40000000-0000-4000-8000-000000000003',null,null,'Global Lead','NEW');

insert into public.marketing_provider_profiles(id,business_id,owner_user_id,name_ar,status,is_verified) values
 ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Provider A Active','ACTIVE',true),
 ('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Provider A Pending','PENDING',false),
 ('50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Provider B Active','ACTIVE',true),
 ('50000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Provider B Pending','PENDING',false),
 ('50000000-0000-4000-8000-000000000005',null,'20000000-0000-4000-8000-000000000002','Global Pending','PENDING',false);

do $acl$
begin
 if not has_table_privilege('authenticated','public.marketing_leads','SELECT')
    or not has_table_privilege('authenticated','public.marketing_provider_profiles','SELECT') then
  raise exception 'TEST_FAILED: read privileges missing from fixture';
 end if;
end;
$acl$;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $business_a$
begin
 if (select count(*) from public.marketing_leads) <> 1
    or not exists(select 1 from public.marketing_leads where title='Lead A')
    or exists(select 1 from public.marketing_leads where title in ('Lead B','Global Lead')) then
  raise exception 'TEST_FAILED: business A can read cross-business/global leads';
 end if;
 if exists(select 1 from public.marketing_provider_profiles where name_ar in ('Provider B Pending','Global Pending')) then
  raise exception 'TEST_FAILED: business A can read unrelated pending provider profiles';
 end if;
 if not exists(select 1 from public.marketing_provider_profiles where name_ar='Provider A Pending')
    or not exists(select 1 from public.marketing_provider_profiles where name_ar='Provider B Active') then
  raise exception 'TEST_FAILED: same-business review or public active provider discovery regressed';
 end if;
end;
$business_a$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
do $business_b$
begin
 if (select count(*) from public.marketing_leads) <> 1
    or not exists(select 1 from public.marketing_leads where title='Lead B')
    or exists(select 1 from public.marketing_leads where title in ('Lead A','Global Lead')) then
  raise exception 'TEST_FAILED: business B can read cross-business/global leads';
 end if;
 if exists(select 1 from public.marketing_provider_profiles where name_ar='Provider A Pending')
    or not exists(select 1 from public.marketing_provider_profiles where name_ar='Provider B Pending') then
  raise exception 'TEST_FAILED: pending provider isolation or same-business review is incorrect';
 end if;
end;
$business_b$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
do $platform_admin$
begin
 if (select count(*) from public.marketing_leads) <> 3 then
  raise exception 'TEST_FAILED: platform full-control admin should read all CRM leads';
 end if;
 if (select count(*) from public.marketing_provider_profiles) <> 5 then
  raise exception 'TEST_FAILED: platform full-control admin should read all provider profiles';
 end if;
end;
$platform_admin$;
reset role;

select 'RC444 CRM business-scope RLS integration: PASS' as result;
