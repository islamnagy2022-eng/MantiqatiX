-- RC102 isolated PostgreSQL fixture. Never run against production.
create role anon nologin;
create role authenticated nologin;

create schema auth;
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create table public.marketing_provider_profiles (
  id uuid primary key,
  owner_user_id uuid not null
);
create table public.marketing_provider_services (
  provider_id uuid not null references public.marketing_provider_profiles(id),
  service_id uuid not null,
  service_description text,
  pricing_from numeric,
  pricing_to numeric,
  currency text not null default 'EGP',
  status text not null default 'ACTIVE',
  primary key (provider_id, service_id)
);
create table public.marketing_services (
  id uuid primary key,
  code text unique,
  name_ar text,
  name_en text,
  category_code text,
  description text,
  status text
);
create table public.user_memberships (
  user_id uuid,
  status text,
  role text
);

insert into public.marketing_provider_profiles(id, owner_user_id) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');

alter table public.marketing_provider_profiles enable row level security;
alter table public.marketing_provider_profiles force row level security;
create policy provider_profile_owner_read
  on public.marketing_provider_profiles for select to authenticated
  using (owner_user_id = auth.uid());

alter table public.marketing_provider_services enable row level security;
alter table public.marketing_provider_services force row level security;
alter table public.marketing_services enable row level security;
alter table public.marketing_services force row level security;

grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function auth.jwt() to authenticated, anon;
grant select on public.marketing_provider_profiles to authenticated;
grant select on public.marketing_provider_services to authenticated;
grant select on public.marketing_services to authenticated;
