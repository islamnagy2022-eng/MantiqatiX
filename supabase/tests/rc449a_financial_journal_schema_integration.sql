-- RC449A schema backfill and compatibility test. Run only in disposable PostgreSQL.
do $test$
declare
  v_entry record;
  v_lines integer[];
  v_posted timestamptz;
  v_updated timestamptz;
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entries' and column_name='entry_number')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entries' and column_name='total_debit')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entries' and column_name='total_credit')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entries' and column_name='posted_at')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entries' and column_name='updated_at')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entries' and column_name='reversed_by_entry_id')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='journal_entry_lines' and column_name='line_number') then
    raise exception 'TEST_FAILED: RC449A did not add all required journal columns';
  end if;

  select * into v_entry from public.journal_entries where id='legacy-posted';
  if v_entry.entry_number <> 'legacy-posted' or v_entry.total_debit <> 100 or v_entry.total_credit <> 100 then
    raise exception 'TEST_FAILED: legacy journal header was not backfilled from ID and lines';
  end if;
  if v_entry.posted_at is distinct from '2026-10-01 12:00:00+00'::timestamptz
     or v_entry.updated_at is distinct from '2026-10-01 12:00:00+00'::timestamptz then
    raise exception 'TEST_FAILED: legacy posted timestamps were not preserved';
  end if;
  select array_agg(line_number order by line_number) into v_lines
  from public.journal_entry_lines where journal_entry_id='legacy-posted';
  if v_lines is distinct from array[1,2] then
    raise exception 'TEST_FAILED: legacy line numbers were not deterministically backfilled: %',v_lines;
  end if;

  select posted_at,updated_at into v_posted,v_updated from public.journal_entries where id='legacy-draft';
  if v_posted is not null or v_updated is distinct from '2026-10-02 12:00:00+00'::timestamptz then
    raise exception 'TEST_FAILED: draft timestamps were not preserved correctly';
  end if;

  insert into public.journal_entries(id,tenant_id,entry_number,status,entry_date,created_by)
  values('new-posted','tenant-a','NEW-POSTED','POSTED',current_date,null);
  if (select posted_at from public.journal_entries where id='new-posted') is null then
    raise exception 'TEST_FAILED: posted_at default must support legacy posted inserts';
  end if;
  if (select total_debit from public.journal_entries where id='new-posted') <> 0
     or (select total_credit from public.journal_entries where id='new-posted') <> 0 then
    raise exception 'TEST_FAILED: totals defaults are missing';
  end if;
  insert into public.journal_entry_lines(id,journal_entry_id,account_id,debit,credit)
  values('new-line','new-posted','cash',1,0);
  if (select line_number from public.journal_entry_lines where id='new-line') <> 1 then
    raise exception 'TEST_FAILED: line_number default is missing';
  end if;
end;
$test$;

select 'RC449A financial journal schema prerequisites integration: PASS' as result;
