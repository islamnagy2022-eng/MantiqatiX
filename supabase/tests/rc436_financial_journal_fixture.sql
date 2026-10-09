-- Disposable fixture for RC436 financial journal integration tests.
create table public.user_memberships (
  id varchar primary key,
  user_id uuid not null,
  tenant_id varchar not null,
  business_id uuid,
  role varchar not null,
  status varchar not null,
  created_at timestamptz not null default now()
);
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
  reference_type varchar,
  reference_id varchar,
  description text,
  status varchar not null default 'POSTED',
  entry_date date not null default current_date,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.journal_entry_lines (
  id varchar primary key,
  journal_entry_id varchar not null,
  account_id varchar not null,
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
  debit numeric not null default 0,
  credit numeric not null default 0,
  running_balance numeric not null default 0,
  entry_date date not null,
  posted_at timestamptz not null default now()
);

create function public.post_financial_journal(jsonb,jsonb)
returns jsonb language sql security definer set search_path=public as $legacy$
  select '{}'::jsonb;
$legacy$;
create function public.post_financial_journal_backend(uuid,jsonb,jsonb)
returns jsonb language sql security definer set search_path=public as $legacy$
  select '{}'::jsonb;
$legacy$;

create function public.rc436_fail_ledger_insert() returns trigger language plpgsql as $trigger$
begin
  if new.journal_entry_id='journal-rollback' then raise exception 'RC436_FORCED_LEDGER_FAILURE'; end if;
  return new;
end;
$trigger$;
create trigger rc436_test_fail_ledger before insert on public.general_ledger
  for each row execute function public.rc436_fail_ledger_insert();
