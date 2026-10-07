-- Education request server-authority boundary
-- Created after live verification of the production function contract.
create or replace function public.create_education_request_backend(p_target_id uuid,p_target_type text,p_student_name text,p_subject_or_grade text)
returns public.education_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.education_requests;
  v_target_type text := upper(trim(coalesce(p_target_type,'')));
  v_student text := trim(coalesce(p_student_name,''));
  v_subject text := trim(coalesce(p_subject_or_grade,''));
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then
    raise exception 'UNAUTHENTICATED';
  end if;
  if p_target_id is null or v_target_type not in ('SCHOOL','TEACHER') then
    raise exception 'INVALID_EDUCATION_TARGET';
  end if;
  if length(v_student)<2 or length(v_student)>200 then
    raise exception 'INVALID_STUDENT_NAME';
  end if;
  if length(v_subject)>500 then
    raise exception 'INVALID_SUBJECT_OR_GRADE';
  end if;
  if v_target_type='SCHOOL' and not exists(select 1 from public.school_profiles s where s.id=p_target_id and coalesce(s.is_available,true)=true) then
    raise exception 'EDUCATION_TARGET_NOT_AVAILABLE';
  end if;
  if v_target_type='TEACHER' and not exists(select 1 from public.teacher_profiles t where t.id=p_target_id and coalesce(t.is_available,true)=true) then
    raise exception 'EDUCATION_TARGET_NOT_AVAILABLE';
  end if;
  insert into public.education_requests(id,requester_user_id,target_id,target_type,student_name,subject_or_grade,status)
  values(gen_random_uuid(),v_uid,p_target_id,v_target_type,v_student,v_subject,'PENDING')
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.create_education_request_backend(uuid,text,text,text) from public, anon;
grant execute on function public.create_education_request_backend(uuid,text,text,text) to authenticated;
revoke insert on table public.education_requests from authenticated;
