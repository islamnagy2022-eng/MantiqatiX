
begin;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id varchar,
  business_id uuid references public.businesses(id) on delete set null,
  title varchar not null,
  company_name varchar not null,
  category varchar not null,
  description text not null default '',
  requirements text not null default '',
  salary_range varchar not null default '',
  location varchar not null default '',
  job_type varchar not null default 'دوام كامل',
  employer_name varchar not null default '',
  employer_phone varchar not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_active_created_at on public.jobs(is_active, created_at desc);
create index if not exists idx_jobs_owner on public.jobs(owner_user_id);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  applicant_name varchar not null,
  applicant_phone varchar not null,
  qualifications text not null default '',
  cv_summary_text text not null default '',
  created_at timestamptz not null default now(),
  unique(job_id, applicant_user_id)
);

create index if not exists idx_job_applications_job on public.job_applications(job_id, created_at desc);
create index if not exists idx_job_applications_applicant on public.job_applications(applicant_user_id, created_at desc);

create table if not exists public.used_item_ads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id varchar,
  business_id uuid references public.businesses(id) on delete set null,
  title varchar not null,
  description text not null default '',
  category varchar not null,
  price numeric(14,2) not null check(price >= 0),
  seller_name varchar not null,
  seller_phone varchar not null,
  image_url text not null default '',
  fee_paid numeric(14,2) not null default 0 check(fee_paid >= 0),
  location varchar not null default '',
  is_sold boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_used_item_ads_active_created_at on public.used_item_ads(is_sold, created_at desc);
create index if not exists idx_used_item_ads_owner on public.used_item_ads(owner_user_id);

create table if not exists public.used_item_category_fees (
  category varchar primary key,
  fee numeric(14,2) not null check(fee >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.used_item_category_fees(category,fee) values
('ELECTRONICS',20),('FURNITURE',30),('VEHICLES',50),('CLOTHES',15),('OTHER',20)
on conflict(category) do nothing;

alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;
alter table public.used_item_ads enable row level security;
alter table public.used_item_category_fees enable row level security;

drop policy if exists jobs_select_authenticated on public.jobs;
create policy jobs_select_authenticated on public.jobs for select to authenticated
using (is_active = true or owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists jobs_insert_owner on public.jobs;
create policy jobs_insert_owner on public.jobs for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists jobs_update_owner_admin on public.jobs;
create policy jobs_update_owner_admin on public.jobs for update to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin())
with check (owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists jobs_delete_owner_admin on public.jobs;
create policy jobs_delete_owner_admin on public.jobs for delete to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists job_applications_select_parties on public.job_applications;
create policy job_applications_select_parties on public.job_applications for select to authenticated
using (
  applicant_user_id = auth.uid()
  or exists(select 1 from public.jobs j where j.id=job_applications.job_id and j.owner_user_id=auth.uid())
  or public.is_platform_admin()
);

drop policy if exists job_applications_insert_self on public.job_applications;
create policy job_applications_insert_self on public.job_applications for insert to authenticated
with check (applicant_user_id = auth.uid());

drop policy if exists job_applications_update_self_admin on public.job_applications;
create policy job_applications_update_self_admin on public.job_applications for update to authenticated
using (applicant_user_id = auth.uid() or public.is_platform_admin())
with check (applicant_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists job_applications_delete_self_admin on public.job_applications;
create policy job_applications_delete_self_admin on public.job_applications for delete to authenticated
using (applicant_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists used_item_ads_select_authenticated on public.used_item_ads;
create policy used_item_ads_select_authenticated on public.used_item_ads for select to authenticated
using (true);

drop policy if exists used_item_ads_insert_owner on public.used_item_ads;
create policy used_item_ads_insert_owner on public.used_item_ads for insert to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists used_item_ads_update_owner_admin on public.used_item_ads;
create policy used_item_ads_update_owner_admin on public.used_item_ads for update to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin())
with check (owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists used_item_ads_delete_owner_admin on public.used_item_ads;
create policy used_item_ads_delete_owner_admin on public.used_item_ads for delete to authenticated
using (owner_user_id = auth.uid() or public.is_platform_admin());

drop policy if exists used_item_category_fees_select_authenticated on public.used_item_category_fees;
create policy used_item_category_fees_select_authenticated on public.used_item_category_fees for select to authenticated
using (true);

drop policy if exists used_item_category_fees_update_admin on public.used_item_category_fees;
create policy used_item_category_fees_update_admin on public.used_item_category_fees for update to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

commit;
