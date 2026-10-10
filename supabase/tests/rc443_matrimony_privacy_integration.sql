-- RC443 privacy behavior tests. Run only in disposable PostgreSQL.
insert into public.matrimony_profiles(
 id,owner_user_id,gender,pseudonym,age,city,country,nationality,education,occupation,marital_status,
 religiosity_level,housing_status,financial_status,about_me,partner_requirements,wali_contact_name,
 wali_contact_phone,direct_contact_phone,is_verified,compatibility_tags,created_at
) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','F','Profile A',29,'Cairo','EG','EG','University','Engineer','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali A','01000000001','01000000002',true,'["reading"]',now()-interval '2 days'),
 ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','M','Profile B',31,'Giza','EG','EG','University','Teacher','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali B','01000000003','01000000004',true,'["family"]',now()-interval '1 day'),
 ('40000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','M','Unverified C',34,'Alexandria','EG','EG','University','Accountant','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali C','01000000005','01000000006',false,'[]',now()),
 ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','F','Profile D',28,'Mansoura','EG','EG','University','Doctor','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE FREE TEXT','PRIVATE FREE TEXT','Wali D','01000000007','01000000008',true,'["travel"]',now());

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
 if has_function_privilege('anon','public.matrimony_create_request_backend(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.matrimony_respond_request_backend(uuid,boolean)','EXECUTE')
    or has_function_privilege('anon','public.matrimony_unlock_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: anonymous role can execute request/contact transition RPCs';
 end if;
 if not has_function_privilege('authenticated','public.matrimony_discover_profiles_backend(integer,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.matrimony_get_unlocked_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: authenticated role cannot execute matrimony privacy RPCs';
 end if;
 if not has_function_privilege('authenticated','public.matrimony_create_request_backend(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.matrimony_respond_request_backend(uuid,boolean)','EXECUTE')
    or not has_function_privilege('authenticated','public.matrimony_unlock_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: authenticated role cannot execute safe request/contact transition RPCs';
 end if;
 if has_table_privilege('authenticated','public.matrimony_requests','INSERT')
    or has_table_privilege('authenticated','public.matrimony_requests','UPDATE')
    or has_table_privilege('authenticated','public.matrimony_contact_unlocks','INSERT') then
   raise exception 'TEST_FAILED: authenticated direct request/unlock writes must be revoked';
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



-- A new request must be created by the server RPC, and only the target owner may accept it.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $request_sender$
declare
 v_request_id uuid;
 v_repeat_id uuid;
 v_status text;
begin
 select request_id,status into v_request_id,v_status
 from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000004','تعريف اختياري');
 if v_request_id is null or v_status <> 'PENDING' then
  raise exception 'TEST_FAILED: safe request creation did not create PENDING request';
 end if;
 perform set_config('test.matrimony_request_id',v_request_id::text,false);

 select request_id,status into v_repeat_id,v_status
 from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000004','retry');
 if v_repeat_id is distinct from v_request_id or v_status <> 'PENDING'
    or (select count(*) from public.matrimony_requests where from_user_id='20000000-0000-4000-8000-000000000001' and to_profile_id='40000000-0000-4000-8000-000000000004' and status='PENDING') <> 1 then
  raise exception 'TEST_FAILED: duplicate request retry must be idempotent';
 end if;

 begin
  perform * from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000001','self');
  raise exception 'TEST_FAILED: self-request unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: self-request unexpectedly succeeded' then raise; end if;
  if sqlerrm <> 'SELF_REQUEST_FORBIDDEN' then raise; end if;
 end;

 begin
  perform * from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000003','unverified');
  raise exception 'TEST_FAILED: request to unverified profile unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: request to unverified profile unexpectedly succeeded' then raise; end if;
  if sqlerrm <> 'PROFILE_NOT_AVAILABLE' then raise; end if;
 end;

 begin
  perform * from public.matrimony_respond_request_backend(v_request_id,true);
  raise exception 'TEST_FAILED: sender unexpectedly accepted own request';
 exception when others then
  if sqlerrm='TEST_FAILED: sender unexpectedly accepted own request' then raise; end if;
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
 end;

 begin
  perform * from public.matrimony_unlock_contact_backend(v_request_id);
  raise exception 'TEST_FAILED: contact unlocked before acceptance';
 exception when others then
  if sqlerrm='TEST_FAILED: contact unlocked before acceptance' then raise; end if;
  if sqlerrm <> 'CONTACT_NOT_UNLOCKED' then raise; end if;
 end;
end;
$request_sender$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',false);
do $request_recipient$
declare
 v_request_id uuid := current_setting('test.matrimony_request_id')::uuid;
 v_status text;
begin
 select status into v_status from public.matrimony_respond_request_backend(v_request_id,true);
 if v_status <> 'ACCEPTED_MUTUAL' then
  raise exception 'TEST_FAILED: target owner could not accept request';
 end if;
end;
$request_recipient$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
do $third_party$
declare
 v_request_id uuid := current_setting('test.matrimony_request_id')::uuid;
begin
 begin
  perform * from public.matrimony_respond_request_backend(v_request_id,true);
  raise exception 'TEST_FAILED: third party resolved a request';
 exception when others then
  if sqlerrm='TEST_FAILED: third party resolved a request' then raise; end if;
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
 end;
 begin
  perform * from public.matrimony_unlock_contact_backend(v_request_id);
  raise exception 'TEST_FAILED: third party unlocked contact';
 exception when others then
  if sqlerrm='TEST_FAILED: third party unlocked contact' then raise; end if;
  if sqlerrm <> 'FORBIDDEN' then raise; end if;
 end;
end;
$third_party$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
do $contact_unlock$
declare
 v_request_id uuid := current_setting('test.matrimony_request_id')::uuid;
 v_phone text;
 v_unlocked_at timestamptz;
 v_repeat_at timestamptz;
begin
 select unlocked_at into v_unlocked_at from public.matrimony_unlock_contact_backend(v_request_id);
 select unlocked_at into v_repeat_at from public.matrimony_unlock_contact_backend(v_request_id);
 if v_unlocked_at is null or v_repeat_at is distinct from v_unlocked_at
    or (select count(*) from public.matrimony_contact_unlocks where request_id=v_request_id) <> 1 then
  raise exception 'TEST_FAILED: contact unlock must be idempotent';
 end if;
 select direct_contact_phone into v_phone from public.matrimony_get_unlocked_contact_backend(v_request_id);
 if v_phone <> '01000000008' then
  raise exception 'TEST_FAILED: newly accepted request returned incorrect contact';
 end if;
end;
$contact_unlock$;
reset role;

-- Anonymous Auth users have a non-null UID and the authenticated DB role; both RPCs must reject them.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","is_anonymous":true}',false);
do $anonymous$
declare
 rejected boolean := false;
begin
 if (select count(*) from public.matrimony_profiles) <> 0 then
  raise exception 'TEST_FAILED: anonymous raw profile SELECT unexpectedly succeeded';
 end if;
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
