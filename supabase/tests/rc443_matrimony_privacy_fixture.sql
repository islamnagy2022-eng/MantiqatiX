-- Disposable RC443 matrimony privacy fixture.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists private;

do $roles$
begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$function$;
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $function$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
$function$;
grant usage on schema auth to public;
grant execute on function auth.uid() to public;
grant execute on function auth.jwt() to public;

create or replace function public.is_platform_admin()
returns boolean language sql stable as $function$ select false $function$;
grant execute on function public.is_platform_admin() to authenticated;

create table public.matrimony_profiles(
  id uuid primary key,
  owner_user_id uuid not null,
  gender text not null,
  pseudonym text not null,
  age integer not null,
  city text not null,
  country text not null,
  nationality text not null,
  education text not null,
  occupation text not null,
  marital_status text not null,
  religiosity_level text not null,
  housing_status text not null,
  financial_status text not null,
  about_me text not null,
  partner_requirements text not null,
  wali_contact_name text not null,
  wali_contact_phone text not null,
  direct_contact_phone text not null,
  is_verified boolean not null default false,
  compatibility_tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table public.matrimony_requests(
  id uuid primary key,
  from_user_id uuid not null,
  to_profile_id uuid not null references public.matrimony_profiles(id),
  status text not null,
  message_text text not null,
  created_at timestamptz not null default now()
);
create table public.matrimony_contact_unlocks(
  id uuid primary key,
  request_id uuid not null references public.matrimony_requests(id),
  unlocked_at timestamptz not null default now()
);

alter table public.matrimony_profiles enable row level security;
alter table public.matrimony_requests enable row level security;
alter table public.matrimony_contact_unlocks enable row level security;
grant select,insert,update on public.matrimony_profiles to authenticated;
grant select,update on public.matrimony_requests to authenticated;
grant select,insert on public.matrimony_contact_unlocks to authenticated;
create policy matrimony_profiles_insert on public.matrimony_profiles
  for insert to authenticated with check (owner_user_id=auth.uid());
create policy matrimony_profiles_update on public.matrimony_profiles
  for update to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
create policy matrimony_profiles_select on public.matrimony_profiles
  for select to authenticated
  using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy authenticated_sessions_only on public.matrimony_profiles as restrictive
  for all to authenticated
  using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false)
  with check (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);

-- Match the live permissive request/unlock policies so negative tests reach the consent guard.
create policy matrimony_requests_select on public.matrimony_requests
  for select to authenticated
  using (from_user_id=auth.uid() or exists(
    select 1 from public.matrimony_profiles p
    where p.id=matrimony_requests.to_profile_id and p.owner_user_id=auth.uid()
  ) or public.is_platform_admin());
create policy matrimony_requests_update on public.matrimony_requests
  for update to authenticated
  using (from_user_id=auth.uid() or exists(
    select 1 from public.matrimony_profiles p
    where p.id=matrimony_requests.to_profile_id and p.owner_user_id=auth.uid()
  ) or public.is_platform_admin())
  with check (from_user_id=auth.uid() or exists(
    select 1 from public.matrimony_profiles p
    where p.id=matrimony_requests.to_profile_id and p.owner_user_id=auth.uid()
  ) or public.is_platform_admin());
create policy matrimony_requests_non_anonymous on public.matrimony_requests as restrictive
  for all to authenticated
  using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false)
  with check (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy matrimony_unlocks_select on public.matrimony_contact_unlocks
  for select to authenticated
  using (exists(
    select 1 from public.matrimony_requests r
    join public.matrimony_profiles p on p.id=r.to_profile_id
    where r.id=matrimony_contact_unlocks.request_id
      and (r.from_user_id=auth.uid() or p.owner_user_id=auth.uid())
  ) or public.is_platform_admin());
create policy matrimony_unlocks_insert on public.matrimony_contact_unlocks
  for insert to authenticated
  with check (exists(
    select 1 from public.matrimony_requests r
    join public.matrimony_profiles p on p.id=r.to_profile_id
    where r.id=matrimony_contact_unlocks.request_id
      and (r.from_user_id=auth.uid() or p.owner_user_id=auth.uid())
      and r.status='ACCEPTED_MUTUAL'
  ));
create policy matrimony_unlocks_non_anonymous on public.matrimony_contact_unlocks as restrictive
  for all to authenticated
  using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false)
  with check (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
