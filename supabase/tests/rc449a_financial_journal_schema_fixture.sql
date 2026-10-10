-- Disposable fixture matching the observed legacy production journal schema before RC449A.
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
  created_by uuid,
  created_at timestamptz not null default current_timestamp
);

create table public.journal_entry_lines (
  id varchar primary key,
  journal_entry_id varchar not null references public.journal_entries(id) on delete cascade,
  account_id varchar not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  description text
);

create table public.general_ledger (
  id varchar primary key,
  tenant_id varchar not null,
  business_id uuid,
  journal_entry_id varchar not null references public.journal_entries(id) on delete restrict,
  journal_line_id varchar not null references public.journal_entry_lines(id) on delete restrict,
  account_id varchar not null,
  debit numeric not null default 0,
  credit numeric not null default 0,
  running_balance numeric not null default 0,
  entry_date date not null default current_date,
  posted_at timestamptz not null default current_timestamp
);

insert into public.journal_entries(id,tenant_id,status,entry_date,created_at)
values
 ('legacy-posted','tenant-a','POSTED','2026-10-01','2026-10-01 12:00:00+00'),
 ('legacy-draft','tenant-a','DRAFT','2026-10-02','2026-10-02 12:00:00+00');

insert into public.journal_entry_lines(id,journal_entry_id,account_id,debit,credit,description)
values
 ('line-b','legacy-posted','cash',100,0,'debit'),
 ('line-a','legacy-posted','revenue',0,100,'credit');
