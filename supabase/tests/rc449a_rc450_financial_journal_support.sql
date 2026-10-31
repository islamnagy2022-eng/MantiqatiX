-- Additional non-journal objects required to run RC450 after RC449A.
-- Required Production business, branch, membership and account constraints are modeled.
create extension if not exists pgcrypto;
create schema if not exists auth;

do $roles$
begin create role anon; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role authenticated; exception when duplicate_object then null; end
$roles$;
do $roles$
begin create role service_role; exception when duplicate_object then null; end
$roles$;

create or replace function auth.uid()
returns uuid language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$function$;

create or replace function auth.role()
returns text language sql stable
as $function$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$function$;

create table public.tenants (
  id varchar primary key
);
insert into public.tenants(id) values ('tenant-a'),('tenant-b');

create table public.organizations (
  id varchar primary key
);
insert into public.organizations(id) values ('org-a'),('org-b');

create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null references public.tenants(id),
  organization_id varchar references public.organizations(id),
  name varchar not null,
  code varchar not null,
  status varchar not null default 'ACTIVE'
    check (status in ('ACTIVE','INACTIVE','SUSPENDED')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

insert into public.businesses(id,tenant_id,organization_id,name,code,status) values
 ('20000000-0000-4000-8000-000000000564','tenant-a','org-a','Finance Test Business A','FIN-A','ACTIVE'),
 ('20000000-0000-4000-8000-000000000566','tenant-a','org-a','Finance Test Business A2','FIN-A2','ACTIVE'),
 ('20000000-0000-4000-8000-000000000565','tenant-b','org-b','Finance Test Business B','FIN-B','ACTIVE');

create table public.branches (
  id varchar primary key,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  organization_id varchar references public.organizations(id) on delete restrict,
  business_id uuid not null references public.businesses(id),
  name varchar not null,
  code varchar not null,
  status varchar not null default 'ACTIVE',
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp,
  constraint uk_branch_biz_code unique (business_id,code)
);

insert into public.branches(id,tenant_id,organization_id,business_id,name,code,status) values
 ('branch-a','tenant-a',null,'20000000-0000-4000-8000-000000000564','Branch A','BR-A','ACTIVE'),
 ('branch-b','tenant-a',null,'20000000-0000-4000-8000-000000000564','Branch B','BR-B','ACTIVE');

create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  organization_id varchar references public.organizations(id) on delete set null,
  business_id uuid references public.businesses(id),
  branch_id varchar references public.branches(id) on delete cascade,
  role varchar not null,
  permissions jsonb default '[]'::jsonb,
  status varchar not null default 'ACTIVE',
  created_at timestamptz not null default current_timestamp,
  constraint uk_user_biz_branch unique (user_id,business_id,branch_id)
);

create table public.chart_of_accounts (
  id varchar primary key,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  account_code varchar not null,
  account_name varchar not null,
  account_type varchar not null,
  is_active boolean not null default true,
  created_at timestamptz not null default current_timestamp,
  constraint uk_tenant_account_code unique (tenant_id,account_code)
);

insert into public.chart_of_accounts(id,tenant_id,account_code,account_name,account_type,is_active) values
 ('cash','tenant-a','1000','Cash','ASSET',true),
 ('revenue','tenant-a','4000','Revenue','REVENUE',true),
 ('inactive','tenant-a','1999','Inactive Test Account','ASSET',false);

-- The pre-RC449A journal fixture is created first. Add the live foreign-key
-- boundaries after its legacy rows and the corresponding parent fixtures exist.
alter table public.journal_entries
  add constraint journal_entries_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete restrict;
alter table public.journal_entries
  add constraint journal_entries_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict;
alter table public.journal_entries
  add constraint journal_entries_branch_id_fkey
  foreign key (branch_id) references public.branches(id) on delete restrict;
alter table public.journal_entry_lines
  add constraint journal_entry_lines_account_id_fkey
  foreign key (account_id) references public.chart_of_accounts(id) on delete restrict;
alter table public.general_ledger
  add constraint general_ledger_tenant_id_fkey
  foreign key (tenant_id) references public.tenants(id) on delete restrict;
alter table public.general_ledger
  add constraint general_ledger_account_id_fkey
  foreign key (account_id) references public.chart_of_accounts(id) on delete restrict;
