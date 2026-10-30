-- Simulate the existing production journal integrity triggers in the disposable test database.
create or replace function public.trg_enforce_journal_line_immutability()
returns trigger language plpgsql as $function$
declare
  v_entry_status varchar;
begin
  select status into v_entry_status
  from public.journal_entries
  where id=case when tg_op='DELETE' then old.journal_entry_id else new.journal_entry_id end;
  if v_entry_status='POSTED' then
    raise exception 'JOURNAL_LINE_IMMUTABLE';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

create trigger trg_journal_line_immutability
before insert or update or delete on public.journal_entry_lines
for each row execute function public.trg_enforce_journal_line_immutability();

create or replace function public.trg_validate_journal_entry_balance()
returns trigger language plpgsql as $function$
declare
  v_sum_debit numeric;
  v_sum_credit numeric;
begin
  if new.status='POSTED' then
    select coalesce(sum(debit),0),coalesce(sum(credit),0)
    into v_sum_debit,v_sum_credit
    from public.journal_entry_lines
    where journal_entry_id=new.id;
    if abs(v_sum_debit-v_sum_credit)>0.0001 then
      raise exception 'DOUBLE_ENTRY_IMBALANCE';
    end if;
    if v_sum_debit<=0 then
      raise exception 'DOUBLE_ENTRY_INVALID';
    end if;
    new.total_debit:=v_sum_debit;
    new.total_credit:=v_sum_credit;
    new.posted_at:=coalesce(new.posted_at,current_timestamp);
  end if;
  return new;
end;
$function$;

create trigger trg_validate_journal_balance
before insert or update on public.journal_entries
for each row execute function public.trg_validate_journal_entry_balance();
