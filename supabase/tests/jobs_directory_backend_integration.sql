-- Behavioral and privilege tests for job directory RPCs; disposable PostgreSQL only.
do $test$
declare
  owner_a constant uuid := '10000000-0000-4000-8000-000000000001';
  owner_b constant uuid := '10000000-0000-4000-8000-000000000002';
  applicant_a constant uuid := '10000000-0000-4000-8000-000000000003';
  applicant_b constant uuid := '10000000-0000-4000-8000-000000000004';
  business_a constant uuid := '20000000-0000-4000-8000-000000000001';
  business_b constant uuid := '20000000-0000-4000-8000-000000000002';
  n integer;
  v_result text;
begin
  insert into public.jobs(id,owner_user_id,tenant_id,business_id,title,company_name,employer_name,category,description,requirements,salary_range,location,job_type,employer_phone,is_active)
  values
   ('30000000-0000-4000-8000-000000000001',owner_b,'tenant-a',business_a,'Active A','Company A','Employer A','operations','desc','req','10k','Cairo','FULL_TIME','01000000001',true),
   ('30000000-0000-4000-8000-000000000002',owner_a,'tenant-a',business_a,'Inactive Owned','Company Owner','Employer Owner','operations','desc','req','12k','Giza','PART_TIME','01000000002',false),
   ('30000000-0000-4000-8000-000000000003',owner_b,'tenant-b',business_b,'Active B','Company B','Employer B','operations','desc','req','15k','Alexandria','FULL_TIME','01000000003',true);

  insert into public.job_applications(id,job_id,applicant_user_id,applicant_name,applicant_phone,qualifications,cv_summary_text)
  values
   ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',applicant_a,'Applicant A','01100000001','Qualified A','Private CV A'),
   ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',applicant_b,'Applicant B','01100000002','Qualified B','Private CV B'),
   ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002',applicant_b,'Applicant B','01100000002','Qualified B','Private CV B');

  if has_table_privilege('authenticated','public.jobs','SELECT')
     or has_table_privilege('authenticated','public.job_applications','SELECT')
     or has_table_privilege('anon','public.jobs','SELECT')
     or has_table_privilege('anon','public.job_applications','SELECT') then
    raise exception 'DIRECT_CLIENT_SELECT_PRIVILEGE_REMAINS';
  end if;
  if has_function_privilege('anon','public.list_jobs_backend(varchar,uuid)','EXECUTE')
     or has_function_privilege('anon','public.list_job_applications_backend(varchar,uuid)','EXECUTE') then
    raise exception 'ANON_CAN_EXECUTE_JOB_DIRECTORY_RPC';
  end if;
  if not has_function_privilege('authenticated','public.list_jobs_backend(varchar,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.list_job_applications_backend(varchar,uuid)','EXECUTE') then
    raise exception 'AUTHENTICATED_CANNOT_EXECUTE_JOB_DIRECTORY_RPC';
  end if;

  perform set_config('request.jwt.claim.sub',owner_a::text,false);
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',false);
  select count(*) into n from public.list_jobs_backend('tenant-a',business_a);
  if n <> 2 then raise exception 'OWNER_JOB_SCOPE_EXPECTED_2_GOT_%',n; end if;
  if not exists(select 1 from public.list_jobs_backend('tenant-a',business_a) where title='Inactive Owned') then
    raise exception 'OWNER_CANNOT_SEE_OWN_INACTIVE_JOB';
  end if;
  if exists(select 1 from public.list_jobs_backend('tenant-a',business_a) where title='Active B') then
    raise exception 'JOB_TENANT_BUSINESS_FILTER_FAILED';
  end if;
  select pg_get_function_result(to_regprocedure('public.list_jobs_backend(character varying,uuid)')) into v_result;
  if v_result ilike '%employer_phone%' then
    raise exception 'JOB_RPC_EXPOSED_EMPLOYER_PHONE';
  end if;
  select count(*) into n from public.list_job_applications_backend(null,null);
  if n <> 1 or not exists(select 1 from public.list_job_applications_backend(null,null) where applicant_name='Applicant B') then
    raise exception 'JOB_OWNER_APPLICATION_SCOPE_FAILED';
  end if;
  select pg_get_function_result(to_regprocedure('public.list_job_applications_backend(character varying,uuid)')) into v_result;
  if v_result ilike '%applicant_phone%' or v_result ilike '%cv_summary_text%' then
    raise exception 'APPLICATION_RPC_EXPOSED_SENSITIVE_FIELDS';
  end if;

  perform set_config('request.jwt.claim.sub',applicant_a::text,false);
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":false}',false);
  select count(*) into n from public.list_job_applications_backend(null,null);
  if n <> 1 or not exists(select 1 from public.list_job_applications_backend(null,null) where applicant_name='Applicant A') then
    raise exception 'APPLICANT_OWN_APPLICATION_SCOPE_FAILED';
  end if;

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}',false);
  begin
    perform * from public.list_jobs_backend(null,null);
    raise exception 'TEST_FAILED: anonymous session accepted';
  exception when sqlstate '42501' then null;
  end;
end
$test$;
