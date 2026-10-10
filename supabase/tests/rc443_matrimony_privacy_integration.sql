-- RC443 privacy behavior tests. Run only in disposable PostgreSQL.
insert into public.matrimony_profiles(
 id,owner_user_id,gender,pseudonym,age,city,country,nationality,education,occupation,marital_status,
 religiosity_level,housing_status,financial_status,about_me,partner_requirements,wali_contact_name,
 wali_contact_phone,direct_contact_phone,is_verified,compatibility_tags,created_at
) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','F','Profile A',29,'Cairo','EG','EG','University','Engineer','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali A','01000000001','01000000002',true,'["reading"]',now()-interval '2 days'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','M','Profile B',31,'Giza','EG','EG','University','Teacher','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali B','01000000003','01000000004',true,'["family"]',now()-interval '1 day'),
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','M','Unverified C',34,'Alexandria','EG','EG','University','Accountant','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali C','01000000005','01000000006',false,'[]',now());

insert into public.matrimony_requests(id,from_user_id,to_profile_id,status,message_text)
values
 ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','ACCEPTED_MUTUAL','test'),
 ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','ACCEPTED_MUTUAL','test');

insert into public.matrimony_contact_unlocks(id,request_id)
values ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');

do $acl$
begin
 if has_function_privilege('anon','public.matrimony_discover_profiles_backend(integer,text,text)','EXECUTE')
    or has_function_privilege('anon','public.matrimony_get_unlocked_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: anonymous role can execute matrimony privacy RPCs';
 end if;
 if not has_function_privilege('authenticated','public.matrimony_discover_profiles_backend(integer,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.matrimony_get_unlocked_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: authenticated role cannot execute matrimony privacy RPCs';
 end if;
 if (select pg_get_function_result('public.matrimony_discover_profiles_backend(integer,text,text)'::regprocedure)) ilike '%contact_phone%'
    or (select pg_get_function_result('public.matrimony_discover_profiles_backend(integer,text,text)'::regprocedure)) ilike '%financial_status%' then
   raise exception 'TEST_FAILED: discovery RPC signature includes private fields';
 end if;
end;
$acl$;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $user_a$
declare
 v_count integer;
 v_phone text;
begin
 if (select count(*) from public.matrimony_profiles) <> 1
    or exists(select 1 from public.matrimony_profiles where id='40000000-0000-4000-8000-000000000002') then
  raise exception 'TEST_FAILED: raw profile reads are not owner-only';
 end if;
 select count(*) into v_count from public.matrimony_discover_profiles_backend(50,null,null);
 if v_count <> 1 or not exists(select 1 from public.matrimony_discover_profiles_backend(50,null,null) where profile_id='40000000-0000-4000-8000-000000000002') then
  raise exception 'TEST_FAILED: discovery should expose verified other profiles only';
 end if;
 select wali_contact_phone into v_phone from public.matrimony_get_unlocked_contact_backend('50000000-0000-4000-8000-000000000001');
 if v_phone <> '01000000003' then raise exception 'TEST_FAILED: unlocked contact for requester is incorrect'; end if;
 begin
  perform * from public.matrimony_get_unlocked_contact_backend('50000000-0000-4000-8000-000000000002');
  raise exception 'TEST_FAILED: contact without unlock unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: contact without unlock unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'CONTACT_NOT_UNLOCKED' then raise; end if;
 end;
end;
$user_a$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
do $user_b$
declare
 v_count integer;
 v_phone text;
begin
 if (select count(*) from public.matrimony_profiles) <> 1
    or exists(select 1 from public.matrimony_profiles where id='40000000-0000-4000-8000-000000000001') then
  raise exception 'TEST_FAILED: second user can read another raw profile';
 end if;
 select count(*) into v_count from public.matrimony_discover_profiles_backend(50,null,null);
 if v_count <> 1 or not exists(select 1 from public.matrimony_discover_profiles_backend(50,null,null) where profile_id='40000000-0000-4000-8000-000000000001') then
  raise exception 'TEST_FAILED: verified discovery results are not correctly scoped';
 end if;
 select direct_contact_phone into v_phone from public.matrimony_get_unlocked_contact_backend('50000000-0000-4000-8000-000000000001');
 if v_phone <> '01000000002' then raise exception 'TEST_FAILED: reciprocal unlocked contact is incorrect'; end if;
end;
$user_b$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
do $user_c$
declare
 rejected boolean := false;
begin
 begin
  update public.matrimony_profiles
  set is_verified=true
  where id='40000000-0000-4000-8000-000000000003';
  raise exception 'TEST_FAILED: profile owner self-verification unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: profile owner self-verification unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'MATRIMONY_VERIFICATION_SERVER_ONLY' then raise; end if;
  rejected := true;
 end;
 if not rejected or (select is_verified from public.matrimony_profiles where id='40000000-0000-4000-8000-000000000003') is true then
  raise exception 'TEST_FAILED: unverified profile was self-verified';
 end if;
end;
$user_c$;
reset role;


-- Anonymous Auth users have a non-null UID and the authenticated DB role; both RPCs must reject them.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","is_anonymous":true}',false);
do $anonymous$
declare
 rejected boolean := false;
begin
 begin
  perform * from public.matrimony_discover_profiles_backend(50,null,null);
  raise exception 'TEST_FAILED: anonymous discovery unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: anonymous discovery unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'AUTH_REQUIRED' then raise; end if;
  rejected := true;
 end;
 if not rejected then raise exception 'TEST_FAILED: anonymous discovery was not denied'; end if;

 rejected := false;
 begin
  perform * from public.matrimony_get_unlocked_contact_backend('50000000-0000-4000-8000-000000000001');
  raise exception 'TEST_FAILED: anonymous contact retrieval unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: anonymous contact retrieval unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'AUTH_REQUIRED' then raise; end if;
  rejected := true;
 end;
 if not rejected then raise exception 'TEST_FAILED: anonymous contact retrieval was not denied'; end if;
end;
$anonymous$;
reset role;

select 'RC443 matrimony privacy boundary integration: PASS' as result;
