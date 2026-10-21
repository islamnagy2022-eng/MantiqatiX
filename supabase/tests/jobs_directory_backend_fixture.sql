-- Disposable PostgreSQL fixture for jobs directory RPC tests only.
create schema if not exists auth;
do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end
$roles$;

create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;
create or replace function auth.jwt()
returns jsonb language sql stable
as $function$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$function$;

create table public.jobs (
  id uuid primary key,
  owner_user_id uuid not null,
  tenant_id varchar,
  business_id uuid,
  title varchar not null,
  company_name varchar,
  employer_name varchar not null,
  category varchar not null,
  description text not null,
  requirements text not null,
  salary_range varchar not null,
  location varchar not null,
  job_type varchar not null,
  employer_phone varchar not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.job_applications (
  id uuid primary key,
  job_id uuid not null references public.jobs(id),
  applicant_user_id uuid not null,
  applicant_name varchar not null,
  applicant_phone varchar not null,
  qualifications text not null,
  cv_summary_text text not null,
  created_at timestamptz not null default now()
);
