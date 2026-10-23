-- Disposable PostgreSQL fixture for RC103 order-status branch authorization.
create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create or replace function auth.role()
returns text language sql stable
as $function$ select nullif(current_setting('request.jwt.claim.role', true), '') $function$;

create table public.orders (
  id uuid primary key,
  tenant_id varchar not null,
  business_id uuid not null,
  branch_id varchar,
  customer_id uuid not null,
  status varchar not null,
  notes text,
  updated_at timestamptz not null default now()
);
create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  status varchar not null default 'ACTIVE'
);
create table public.payment_intents (
  order_id uuid not null,
  status text not null,
  created_at timestamptz not null default now()
);

insert into public.orders(id,tenant_id,business_id,branch_id,customer_id,status)
values
 ('30000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','10000000-0000-4000-8000-000000000003','PENDING'),
 ('30000000-0000-4000-8000-000000000002','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','10000000-0000-4000-8000-000000000003','PENDING'),
 ('30000000-0000-4000-8000-000000000003','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','10000000-0000-4000-8000-000000000003','PENDING'),
 ('30000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000001','branch-b','10000000-0000-4000-8000-000000000003','PENDING'),
 ('30000000-0000-4000-8000-000000000005','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','10000000-0000-4000-8000-000000000003','PENDING');

insert into public.user_memberships(id,user_id,tenant_id,business_id,branch_id,role,status)
values
 ('membership-manager-a','10000000-0000-4000-8000-000000000001','tenant-a','20000000-0000-4000-8000-000000000001','branch-a','MANAGER','ACTIVE'),
 ('membership-owner','10000000-0000-4000-8000-000000000002','tenant-a',null,null,'OWNER','ACTIVE'),
 ('membership-admin-other-business','10000000-0000-4000-8000-000000000004','tenant-a','20000000-0000-4000-8000-000000000002','branch-b','ADMIN','ACTIVE'),
 ('membership-owner-partial-scope','10000000-0000-4000-8000-000000000005','tenant-a',null,'branch-a','OWNER','ACTIVE');

insert into public.payment_intents(order_id,status)
values ('30000000-0000-4000-8000-000000000004','SUCCEEDED');
