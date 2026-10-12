
create table if not exists public.school_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  school_type text not null,
  location text not null,
  rating numeric(3,2) not null default 0,
  phone text not null default '',
  available_grades jsonb not null default '[]'::jsonb,
  tuition_fee numeric(14,2) not null default 0,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.teacher_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null,
  rating numeric(3,2) not null default 0,
  phone text not null default '',
  hourly_rate numeric(14,2) not null default 0,
  is_available boolean not null default true,
  location text not null default '',
  experience_years integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.education_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null,
  target_type text not null,
  student_name text not null,
  subject_or_grade text not null default '',
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);
alter table public.school_profiles enable row level security;
alter table public.teacher_profiles enable row level security;
alter table public.education_requests enable row level security;
create policy school_profiles_select on public.school_profiles for select to authenticated using (is_available or owner_user_id=auth.uid() or public.is_platform_admin());
create policy school_profiles_insert on public.school_profiles for insert to authenticated with check (owner_user_id=auth.uid());
create policy school_profiles_update on public.school_profiles for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
create policy school_profiles_delete on public.school_profiles for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy teacher_profiles_select on public.teacher_profiles for select to authenticated using (is_available or owner_user_id=auth.uid() or public.is_platform_admin());
create policy teacher_profiles_insert on public.teacher_profiles for insert to authenticated with check (owner_user_id=auth.uid());
create policy teacher_profiles_update on public.teacher_profiles for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
create policy teacher_profiles_delete on public.teacher_profiles for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy education_requests_select on public.education_requests for select to authenticated using (requester_user_id=auth.uid() or public.is_platform_admin());
create policy education_requests_insert on public.education_requests for insert to authenticated with check (requester_user_id=auth.uid());
create policy education_requests_update on public.education_requests for update to authenticated using (requester_user_id=auth.uid() or public.is_platform_admin()) with check (requester_user_id=auth.uid() or public.is_platform_admin());
grant select,insert,update,delete on public.school_profiles, public.teacher_profiles, public.education_requests to authenticated;

create table if not exists public.matrimony_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  gender text not null,
  pseudonym text not null,
  age integer not null,
  city text not null,
  country text not null default 'مصر',
  nationality text not null default 'مصري',
  education text not null default '',
  occupation text not null default '',
  marital_status text not null default '',
  religiosity_level text not null default '',
  housing_status text not null default '',
  financial_status text not null default '',
  about_me text not null default '',
  partner_requirements text not null default '',
  wali_contact_name text not null default '',
  wali_contact_phone text not null default '',
  direct_contact_phone text not null default '',
  is_verified boolean not null default false,
  compatibility_tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.matrimony_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_profile_id uuid not null references public.matrimony_profiles(id) on delete cascade,
  status text not null default 'PENDING',
  message_text text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.matrimony_contact_unlocks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.matrimony_requests(id) on delete cascade,
  unlocked_at timestamptz not null default now()
);
alter table public.matrimony_profiles enable row level security;
alter table public.matrimony_requests enable row level security;
alter table public.matrimony_contact_unlocks enable row level security;
create policy matrimony_profiles_select on public.matrimony_profiles for select to authenticated using (true);
create policy matrimony_profiles_insert on public.matrimony_profiles for insert to authenticated with check (owner_user_id=auth.uid());
create policy matrimony_profiles_update on public.matrimony_profiles for update to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin()) with check (owner_user_id=auth.uid() or public.is_platform_admin());
create policy matrimony_profiles_delete on public.matrimony_profiles for delete to authenticated using (owner_user_id=auth.uid() or public.is_platform_admin());
create policy matrimony_requests_select on public.matrimony_requests for select to authenticated using (from_user_id=auth.uid() or exists(select 1 from public.matrimony_profiles p where p.id=to_profile_id and p.owner_user_id=auth.uid()) or public.is_platform_admin());
create policy matrimony_requests_insert on public.matrimony_requests for insert to authenticated with check (from_user_id=auth.uid());
create policy matrimony_requests_update on public.matrimony_requests for update to authenticated using (from_user_id=auth.uid() or exists(select 1 from public.matrimony_profiles p where p.id=to_profile_id and p.owner_user_id=auth.uid()) or public.is_platform_admin()) with check (from_user_id=auth.uid() or exists(select 1 from public.matrimony_profiles p where p.id=to_profile_id and p.owner_user_id=auth.uid()) or public.is_platform_admin());
create policy matrimony_unlocks_select on public.matrimony_contact_unlocks for select to authenticated using (exists(select 1 from public.matrimony_requests r join public.matrimony_profiles p on p.id=r.to_profile_id where r.id=request_id and (r.from_user_id=auth.uid() or p.owner_user_id=auth.uid())) or public.is_platform_admin());
create policy matrimony_unlocks_insert on public.matrimony_contact_unlocks for insert to authenticated with check (exists(select 1 from public.matrimony_requests r join public.matrimony_profiles p on p.id=r.to_profile_id where r.id=request_id and (r.from_user_id=auth.uid() or p.owner_user_id=auth.uid()) and r.status='ACCEPTED_MUTUAL'));
grant select,insert,update,delete on public.matrimony_profiles, public.matrimony_requests, public.matrimony_contact_unlocks to authenticated;
