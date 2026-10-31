-- Disposable PostgreSQL fixture for RC450 financial journal integration tests only.
-- Models current mandatory tenant/business/branch/membership/account fields.
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

create table public.tenants (id varchar primary key);
insert into public.tenants(id) values ('tenant-a'),('tenant-b');
create table public.organizations (id varchar primary key);
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

create table public.journal_entries (
  id varchar primary key,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  organization_id varchar references public.organizations(id) on delete restrict,
  business_id uuid,
  branch_id varchar references public.branches(id) on delete restrict,
  entry_number varchar not null,
  reference_type varchar,
  reference_id varchar,
  description text,
  status varchar not null,
  total_debit numeric not null,
  total_credit numeric not null,
  entry_date date not null,
  posted_at timestamptz not null,
  updated_at timestamptz not null default current_timestamp,
  reversed_by_entry_id varchar references public.journal_entries(id),
  created_by uuid
);
create table public.journal_entry_lines (
  id varchar primary key,
  journal_entry_id varchar not null references public.journal_entries(id) on delete cascade,
  account_id varchar not null references public.chart_of_accounts(id) on delete restrict,
  line_number integer not null,
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  description text
);
create table public.general_ledger (
  id varchar primary key,
  tenant_id varchar not null references public.tenants(id) on delete restrict,
  business_id uuid,
  journal_entry_id varchar not null references public.journal_entries(id) on delete restrict,
  journal_line_id varchar not null references public.journal_entry_lines(id) on delete restrict,
  account_id varchar not null references public.chart_of_accounts(id) on delete restrict,
  debit numeric not null check (debit >= 0),
  credit numeric not null check (credit >= 0),
  running_balance numeric not null,
  entry_date date not null,
  posted_at timestamptz not null
);

-- Model the production posting/immutability triggers for this disposable integration test.
create or replace function public.trg_enforce_journal_line_immutability()
returns trigger language plpgsql as $function$
declare v_entry_status varchar;
begin
  select status into v_entry_status from public.journal_entries
  where id=case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  if v_entry_status='POSTED' then raise exception 'JOURNAL_LINE_IMMUTABLE'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;
create trigger trg_journal_line_immutability
before insert or update or delete on public.journal_entry_lines
for each row execute function public.trg_enforce_journal_line_immutability();

create or replace function public.trg_validate_journal_entry_balance()
returns trigger language plpgsql as $function$
declare v_sum_debit numeric; v_sum_credit numeric;
begin
  if new.status='POSTED' then
    select coalesce(sum(debit),0),coalesce(sum(credit),0) into v_sum_debit,v_sum_credit
    from public.journal_entry_lines where journal_entry_id=new.id;
    if abs(v_sum_debit-v_sum_credit)>0.0001 then raise exception 'DOUBLE_ENTRY_IMBALANCE'; end if;
    if v_sum_debit<=0 then raise exception 'DOUBLE_ENTRY_INVALID'; end if;
    new.total_debit:=v_sum_debit; new.total_credit:=v_sum_credit;
    new.posted_at:=coalesce(new.posted_at,current_timestamp);
  end if;
  return new;
end;
$function$;
create trigger trg_validate_journal_balance
before insert or update on public.journal_entries
for each row execute function public.trg_validate_journal_entry_balance();
