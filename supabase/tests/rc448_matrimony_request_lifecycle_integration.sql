-- RC448 request lifecycle tests; run only after the RC447 fixture/migration/test on disposable PostgreSQL.
insert into public.matrimony_profiles(
 id,owner_user_id,gender,pseudonym,age,city,country,nationality,education,occupation,marital_status,
 religiosity_level,housing_status,financial_status,about_me,partner_requirements,wali_contact_name,
 wali_contact_phone,direct_contact_phone,is_verified,compatibility_tags,created_at
) values
 ('40000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004','F','Profile D',27,'Tanta','EG','EG','University','Doctor','Single','PRIVATE','PRIVATE','PRIVATE','PRIVATE','PRIVATE','Wali D','01000000007','01000000008',true,'["family"]',now())
on conflict (id) do nothing;

do $acl$
begin
 if has_table_privilege('authenticated','public.matrimony_requests','INSERT')
    or has_table_privilege('authenticated','public.matrimony_requests','UPDATE')
    or has_table_privilege('authenticated','public.matrimony_requests','DELETE') then
   raise exception 'TEST_FAILED: authenticated can mutate matrimony requests directly';
 end if;
 if has_table_privilege('authenticated','public.matrimony_contact_unlocks','INSERT')
    or has_table_privilege('authenticated','public.matrimony_contact_unlocks','UPDATE')
    or has_table_privilege('authenticated','public.matrimony_contact_unlocks','DELETE') then
   raise exception 'TEST_FAILED: authenticated can mutate contact unlocks directly';
 end if;
 if has_function_privilege('anon','public.matrimony_create_request_backend(uuid,text)','EXECUTE')
    or has_function_privilege('anon','public.matrimony_respond_request_backend(uuid,boolean)','EXECUTE')
    or has_function_privilege('anon','public.matrimony_unlock_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: anonymous role can execute request lifecycle RPCs';
 end if;
 if not has_function_privilege('authenticated','public.matrimony_create_request_backend(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.matrimony_respond_request_backend(uuid,boolean)','EXECUTE')
    or not has_function_privilege('authenticated','public.matrimony_unlock_contact_backend(uuid)','EXECUTE') then
   raise exception 'TEST_FAILED: authenticated role cannot execute intended request lifecycle RPCs';
 end if;
end;
$acl$;

-- Verified sender can create a request; repeated identical submission is idempotent.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
do $create_request$
declare
 v_first_id uuid;
 v_second_id uuid;
 v_status text;
begin
 select x.request_id,x.status into v_first_id,v_status
 from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000004','Hello') x;
 select x.request_id,x.status into v_second_id,v_status
 from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000004','Retry') x;
 if v_first_id is null or v_first_id is distinct from v_second_id or v_status <> 'PENDING' then
  raise exception 'TEST_FAILED: repeated request creation must return the same active request';
 end if;
 perform set_config('test.rc448_request_id',v_first_id::text,false);

 begin
  perform * from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000001','Self');
  raise exception 'TEST_FAILED: self-request unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: self-request unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'SELF_REQUEST_FORBIDDEN' then raise; end if;
 end;

 begin
  perform * from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000003','Unverified');
  raise exception 'TEST_FAILED: request to unverified profile unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: request to unverified profile unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'PROFILE_NOT_AVAILABLE' then raise; end if;
 end;
end;
$create_request$;
reset role;

-- An unrelated account cannot accept another profile's incoming request.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
do $third_party$
declare
 v_request_id uuid := current_setting('test.rc448_request_id')::uuid;
begin
 begin
  perform * from public.matrimony_respond_request_backend(v_request_id,true);
  raise exception 'TEST_FAILED: unrelated user accepted request';
 exception when others then
  if sqlerrm='TEST_FAILED: unrelated user accepted request' then raise; end if;
  if sqlerrm<>'FORBIDDEN' then raise; end if;
 end;
end;
$third_party$;
reset role;

-- Only the recipient can accept; contact unlock is idempotent and cannot be forged by direct DML.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000004","is_anonymous":false}',false);
do $accept_and_unlock$
declare
 v_request_id uuid := current_setting('test.rc448_request_id')::uuid;
 v_status text;
 v_first timestamptz;
 v_second timestamptz;
 v_phone text;
begin
 select x.status into v_status
 from public.matrimony_respond_request_backend(v_request_id,true) x;
 if v_status <> 'ACCEPTED_MUTUAL' then
  raise exception 'TEST_FAILED: recipient acceptance did not change request status';
 end if;

 select x.unlocked_at into v_first
 from public.matrimony_unlock_contact_backend(v_request_id) x;
 select x.unlocked_at into v_second
 from public.matrimony_unlock_contact_backend(v_request_id) x;
 if v_first is null or v_first is distinct from v_second
    or (select count(*) from public.matrimony_contact_unlocks u where u.request_id=v_request_id) <> 1 then
  raise exception 'TEST_FAILED: contact unlock must be idempotent';
 end if;

 select x.direct_contact_phone into v_phone
 from public.matrimony_get_unlocked_contact_backend(v_request_id) x;
 if v_phone <> '01000000002' then
  raise exception 'TEST_FAILED: recipient received incorrect counterpart contact';
 end if;
end;
$accept_and_unlock$;
reset role;

-- Sender receives counterpart contact; an unrelated third party remains denied.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000001","is_anonymous":false}',false);
do $sender_contact$
declare
 v_request_id uuid := current_setting('test.rc448_request_id')::uuid;
 v_phone text;
begin
 select x.direct_contact_phone into v_phone
 from public.matrimony_get_unlocked_contact_backend(v_request_id) x;
 if v_phone <> '01000000008' then
  raise exception 'TEST_FAILED: sender received incorrect counterpart contact';
 end if;
end;
$sender_contact$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000003',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000003","is_anonymous":false}',false);
do $unrelated_contact$
declare
 v_request_id uuid := current_setting('test.rc448_request_id')::uuid;
begin
 begin
  perform * from public.matrimony_get_unlocked_contact_backend(v_request_id);
  raise exception 'TEST_FAILED: unrelated user contact retrieval unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: unrelated user contact retrieval unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'FORBIDDEN' then raise; end if;
 end;
end;
$unrelated_contact$;
reset role;

-- Create a second pending request and verify contacts stay closed until recipient acceptance.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000004',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000004","is_anonymous":false}',false);
do $pending_request$
declare
 v_request_id uuid;
begin
 select x.request_id into v_request_id
 from public.matrimony_create_request_backend('40000000-0000-4000-8000-000000000002','Pending only') x;
 perform set_config('test.rc448_pending_request_id',v_request_id::text,false);
 begin
  perform * from public.matrimony_get_unlocked_contact_backend(v_request_id);
  raise exception 'TEST_FAILED: pending request contact unexpectedly succeeded';
 exception when others then
  if sqlerrm='TEST_FAILED: pending request contact unexpectedly succeeded' then raise; end if;
  if sqlerrm<>'CONTACT_NOT_UNLOCKED' then raise; end if;
 end;
end;
$pending_request$;
reset role;

-- Recipient rejects; retries of the same decision are idempotent and opposite decisions fail.
set role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
select set_config('request.jwt.claims','{"sub":"20000000-0000-4000-8000-000000000002","is_anonymous":false}',false);
do $reject_request$
declare
 v_request_id uuid := current_setting('test.rc448_pending_request_id')::uuid;
 v_status text;
begin
 select x.status into v_status
 from public.matrimony_respond_request_backend(v_request_id,false) x;
 if v_status <> 'REJECTED' then
  raise exception 'TEST_FAILED: recipient rejection did not persist';
 end if;
 select x.status into v_status
 from public.matrimony_respond_request_backend(v_request_id,false) x;
 if v_status <> 'REJECTED' then
  raise exception 'TEST_FAILED: repeated rejection was not idempotent';
 end if;
 begin
  perform * from public.matrimony_respond_request_backend(v_request_id,true);
  raise exception 'TEST_FAILED: rejected request was later accepted';
 exception when others then
  if sqlerrm='TEST_FAILED: rejected request was later accepted' then raise; end if;
  if sqlerrm<>'REQUEST_ALREADY_RESOLVED' then raise; end if;
 end;
end;
$reject_request$;
reset role;

select 'RC448 matrimony request lifecycle integration: PASS' as result;
