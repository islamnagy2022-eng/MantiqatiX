-- RC449A: restore the journal schema prerequisites used by existing posting/reversal functions and RC450.
-- Forward-only; this migration must run before 20261010180000_rc450_financial_journal_service_role_boundary.sql.

do $preflight$
begin
  if to_regclass('public.journal_entries') is null
     or to_regclass('public.journal_entry_lines') is null
     or to_regclass('public.general_ledger') is null then
    raise exception 'RC449A prerequisite missing: journal_entries, journal_entry_lines, or general_ledger';
  end if;
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='id' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='tenant_id' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='status' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='created_at' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entry_lines'::regclass and attname='journal_entry_id' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entry_lines'::regclass and attname='debit' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entry_lines'::regclass and attname='credit' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.general_ledger'::regclass and attname='running_balance' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.general_ledger'::regclass and attname='posted_at' and not attisdropped) then
    raise exception 'RC449A prerequisite missing: legacy journal columns do not match the reviewed baseline';
  end if;
end;
$preflight$;

alter table public.journal_entries add column if not exists entry_number varchar;
alter table public.journal_entries add column if not exists total_debit numeric;
alter table public.journal_entries add column if not exists total_credit numeric;
alter table public.journal_entries add column if not exists posted_at timestamptz;
alter table public.journal_entries add column if not exists updated_at timestamptz;
alter table public.journal_entries add column if not exists reversed_by_entry_id varchar;

-- Backfill legacy headers from the immutable journal ID and the actual detail lines.
update public.journal_entries
set entry_number=id
where entry_number is null or pg_catalog.btrim(entry_number)='';

update public.journal_entries je
set total_debit=coalesce((
  select sum(l.debit) from public.journal_entry_lines l where l.journal_entry_id=je.id
),0)
where total_debit is null;

update public.journal_entries je
set total_credit=coalesce((
  select sum(l.credit) from public.journal_entry_lines l where l.journal_entry_id=je.id
),0)
where total_credit is null;

update public.journal_entries
set posted_at=created_at
where status in ('POSTED','REVERSED') and posted_at is null;

update public.journal_entries
set updated_at=coalesce(created_at,pg_catalog.now())
where updated_at is null;

alter table public.journal_entries alter column total_debit set default 0;
alter table public.journal_entries alter column total_credit set default 0;
alter table public.journal_entries alter column total_debit set not null;
alter table public.journal_entries alter column total_credit set not null;
alter table public.journal_entries alter column posted_at set default pg_catalog.now();
alter table public.journal_entries alter column updated_at set default pg_catalog.now();
alter table public.journal_entries alter column updated_at set not null;

-- Only assign line numbers when the legacy schema did not have that column.
do $line_numbers$
declare
  v_missing boolean;
begin
  select not exists(
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.journal_entry_lines'::regclass
      and attname='line_number' and not attisdropped
  ) into v_missing;

  if v_missing then
    alter table public.journal_entry_lines add column line_number integer;
    with numbered as (
      select l.id,row_number() over(partition by l.journal_entry_id order by l.id) as rn
      from public.journal_entry_lines l
    )
    update public.journal_entry_lines l
    set line_number=numbered.rn::integer
    from numbered
    where numbered.id=l.id;
  else
    with numbered as (
      select l.id,
        coalesce(max(l.line_number) filter (where l.line_number is not null)
          over(partition by l.journal_entry_id),0)
        + row_number() over(partition by l.journal_entry_id order by l.id) as rn
      from public.journal_entry_lines l
    )
    update public.journal_entry_lines l
    set line_number=numbered.rn::integer
    from numbered
    where numbered.id=l.id and l.line_number is null;
  end if;
end;
$line_numbers$;

update public.journal_entry_lines
set line_number=1
where line_number is null;

alter table public.journal_entry_lines alter column line_number set default 1;
alter table public.journal_entry_lines alter column line_number set not null;

create index if not exists general_ledger_running_balance_lookup_idx
  on public.general_ledger(tenant_id,account_id,posted_at desc,id desc);

do $verify$
begin
  if not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='entry_number' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='total_debit' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='total_credit' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='posted_at' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='updated_at' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entries'::regclass and attname='reversed_by_entry_id' and not attisdropped)
     or not exists(select 1 from pg_catalog.pg_attribute where attrelid='public.journal_entry_lines'::regclass and attname='line_number' and not attisdropped) then
    raise exception 'RC449A schema verification failed';
  end if;
end;
$verify$;

comment on table public.journal_entries is
  'RC449A restores journal header fields required by the existing posting/reversal functions and the RC450 service-role boundary.';
