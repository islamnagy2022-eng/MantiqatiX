-- Secure job application submission boundary.
create or replace function public.submit_job_application_backend(
  p_user_id uuid,
  p_job_id uuid,
  p_applicant_name text,
  p_applicant_phone text,
  p_qualifications text,
  p_cv_summary_text text
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_id uuid;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'AUTH_USER_MISMATCH'; end if;
  if p_job_id is null then raise exception 'INVALID_JOB'; end if;
  if nullif(trim(coalesce(p_applicant_name,'')),'') is null then raise exception 'APPLICANT_NAME_REQUIRED'; end if;
  if nullif(trim(coalesce(p_applicant_phone,'')),'') is null then raise exception 'APPLICANT_PHONE_REQUIRED'; end if;
  if nullif(trim(coalesce(p_qualifications,'')),'') is null then raise exception 'QUALIFICATIONS_REQUIRED'; end if;
  if nullif(trim(coalesce(p_cv_summary_text,'')),'') is null then raise exception 'CV_SUMMARY_REQUIRED'; end if;
  if not exists(select 1 from public.jobs j where j.id=p_job_id) then raise exception 'JOB_NOT_FOUND'; end if;
  if exists(select 1 from public.job_applications a where a.job_id=p_job_id and a.applicant_user_id=auth.uid()) then
    select id into v_id from public.job_applications where job_id=p_job_id and applicant_user_id=auth.uid() limit 1;
    return jsonb_build_object('id',v_id,'status','ALREADY_APPLIED');
  end if;
  insert into public.job_applications(job_id,applicant_user_id,applicant_name,applicant_phone,qualifications,cv_summary_text)
  values(p_job_id,auth.uid(),trim(p_applicant_name),trim(p_applicant_phone),trim(p_qualifications),trim(p_cv_summary_text))
  returning id into v_id;
  return jsonb_build_object('id',v_id,'status','SUBMITTED');
end;
$$;
revoke execute on function public.submit_job_application_backend(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_job_application_backend(uuid,uuid,text,text,text,text) to authenticated;
