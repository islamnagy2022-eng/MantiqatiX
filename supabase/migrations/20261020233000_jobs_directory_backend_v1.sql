-- RC — narrow, server-authorized reads for job listings and applications.
-- Public listings never expose employer phone; application lists never expose applicant phone or CV summary.
begin;

create or replace function public.list_jobs_backend(
  p_tenant_id varchar default null,
  p_business_id uuid default null
)
returns table (
  id uuid,
  title varchar,
  company_name varchar,
  category varchar,
  location varchar,
  job_type varchar,
  salary_range varchar,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'authenticated non-anonymous session required'
      using errcode = '42501';
  end if;

  return query
    select j.id, j.title, j.employer_name, j.category, j.location,
           j.job_type, j.salary_range, j.is_active, j.created_at
      from public.jobs as j
     where (j.is_active = true or j.owner_user_id = auth.uid())
       and (p_tenant_id is null or j.tenant_id = p_tenant_id)
       and (p_business_id is null or j.business_id = p_business_id)
     order by j.created_at desc
     limit 100;
end;
$function$;

create or replace function public.list_job_applications_backend(
  p_tenant_id varchar default null,
  p_business_id uuid default null
)
returns table (
  id uuid,
  job_id uuid,
  applicant_name varchar,
  qualifications text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null
     or coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then
    raise exception 'authenticated non-anonymous session required'
      using errcode = '42501';
  end if;

  return query
    select a.id, a.job_id, a.applicant_name, a.qualifications, a.created_at
      from public.job_applications as a
     where a.applicant_user_id = auth.uid()
        or exists (
          select 1
            from public.jobs as j
           where j.id = a.job_id
             and j.owner_user_id = auth.uid()
             and (p_tenant_id is null or j.tenant_id = p_tenant_id)
             and (p_business_id is null or j.business_id = p_business_id)
        )
     order by a.created_at desc
     limit 100;
end;
$function$;

revoke select on table public.jobs, public.job_applications from anon, authenticated;
revoke all on function public.list_jobs_backend(varchar, uuid) from public, anon;
revoke all on function public.list_job_applications_backend(varchar, uuid) from public, anon;
grant execute on function public.list_jobs_backend(varchar, uuid) to authenticated;
grant execute on function public.list_job_applications_backend(varchar, uuid) to authenticated;

commit;
