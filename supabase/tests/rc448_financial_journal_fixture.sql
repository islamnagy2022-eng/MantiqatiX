-- Disposable PostgreSQL fixture for RC448 financial journal integration tests only.
create extension if not exists pgcrypto;
create schema if not exists auth;
do $roles$
begin
  create role anon;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role authenticated;
exception when duplicate_object then null;
end
$roles$;
do $roles$
begin
  create role service_role;
exception when duplicate_object then null;
end
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

create table public.user_memberships (
  user_id uuid not null,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  role varchar not null,
  status varchar not null
);
create table public.businesses (
  id uuid primary key,
  tenant_id varchar not null,
  organization_id varchar,
  status varchar not null
);
create table public.branches (
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid not null,
  status varchar not null
);
insert into public.businesses(id,tenant_id,organization_id,status) values
 ('20000000-0000-4000-8000-000000000564','tenant-a','org-a','ACTIVE'),
 ('20000000-0000-4000-8000-000000000566','tenant-a','org-a','ACTIVE'),
 ('20000000-0000-4000-8000-000000000565','tenant-b','org-b','ACTIVE');
insert into public.branches(id,tenant_id,organization_id,business_id,status) values
 ('branch-a','tenant-a',null,'20000000-0000-4000-8000-000000000564','ACTIVE'),
 ('branch-b','tenant-a',null,'20000000-0000-4000-8000-000000000564','ACTIVE');
create table public.chart_of_accounts (
  id varchar primary key,
  tenant_id varchar not null,
  is_active boolean not null default true
);
create table public.journal_entries (
  id varchar primary key,
  tenant_id varchar not null,
  organization_id varchar,
  business_id uuid,
  branch_id varchar,
  entry_number varchar not null,
  reference_type varchar,
  reference_id varchar,
  description text,
  status varchar not null,
  total_debit numeric not null,
  total_credit numeric not null,
  entry_date date not null,
  posted_at timestamptz not null,
  created_by uuid not null
);
create table public.journal_entry_lines (
  id varchar primary key,
  journal_entry_id varchar not null,
  account_id varchar not null,
  line_number integer not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  description text
);
create table public.general_ledger (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid,
  journal_entry_id varchar not null,
  journal_line_id varchar not null,
  account_id varchar not null,
  debit numeric not null,
  credit numeric not null,
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
