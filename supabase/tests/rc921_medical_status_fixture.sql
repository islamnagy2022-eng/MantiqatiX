-- Disposable PostgreSQL 17 fixture for RC921. Never run against Production.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create or replace function auth.uid()
returns uuid language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.businesses (
  id uuid primary key,
  tenant_id text not null
);
create table public.user_memberships (
  user_id uuid not null,
  tenant_id text not null,
  business_id uuid,
  role text not null,
  status text not null
);
create table public.marketing_provider_profiles (
  id uuid primary key,
  owner_user_id uuid not null,
  business_id uuid not null,
  status text not null
);
create table public.medical_appointments (
  id text primary key,
  tenant_id text not null,
  business_id uuid not null,
  patient_id uuid not null,
  doctor_id text not null,
  status text not null,
  updated_at timestamptz not null default now()
);

insert into public.businesses values
 ('a0000000-0000-4000-8000-000000000001','TENANT-A'),
 ('a0000000-0000-4000-8000-000000000002','TENANT-A'),
 ('a0000000-0000-4000-8000-000000000003','TENANT-B');

insert into public.marketing_provider_profiles values
 ('b0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','ACTIVE'),
 ('b0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','ACTIVE');

insert into public.user_memberships values
 ('c0000000-0000-4000-8000-000000000001','TENANT-A','a0000000-0000-4000-8000-000000000001','SERVICE_PROVIDER','ACTIVE'),
 ('c0000000-0000-4000-8000-000000000002','TENANT-A','a0000000-0000-4000-8000-000000000001','SERVICE_PROVIDER','ACTIVE'),
 ('c0000000-0000-4000-8000-000000000003','TENANT-A','a0000000-0000-4000-8000-000000000002','MANAGER','ACTIVE'),
 ('c0000000-0000-4000-8000-000000000004','TENANT-B','a0000000-0000-4000-8000-000000000003','ADMIN','ACTIVE');

insert into public.medical_appointments values
 ('RC921-PROVIDER-A','TENANT-A','a0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','BOOKED',now()),
 ('RC921-PROVIDER-B','TENANT-A','a0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','BOOKED',now()),
 ('RC921-PATIENT','TENANT-A','a0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','BOOKED',now()),
 ('RC921-CROSS-BIZ','TENANT-A','a0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001','BOOKED',now()),
 ('RC921-CROSS-TENANT','TENANT-A','a0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001','BOOKED',now()),
 ('RC921-TERMINAL','TENANT-A','a0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000001','COMPLETED',now());

grant usage on schema public, auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
