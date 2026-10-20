-- Minimal PostgreSQL fixture for RC469 presence guard integration.
create role anon;
create role authenticated;
create schema auth;
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.mantigo_captain_profiles (
  captain_id uuid primary key,
  availability_status text not null default 'OFFLINE',
  current_lat double precision,
  current_lon double precision,
  last_seen_at timestamptz,
  updated_at timestamptz,
  vehicle_category text,
  status text,
  verification_status text
);
create table public.audit_logs (
  id text primary key,
  tenant_id text,
  actor_user_id uuid,
  action text,
  entity_type text,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  result text
);
insert into public.mantigo_captain_profiles
  (captain_id,availability_status,vehicle_category,status,verification_status)
values
  ('00000000-0000-4000-8000-000000000001','OFFLINE','CAR','ACTIVE','VERIFIED'),
  ('00000000-0000-4000-8000-000000000002','OFFLINE','CAR','ACTIVE','PENDING'),
  ('00000000-0000-4000-8000-000000000003','OFFLINE','CAR',null,'VERIFIED');
