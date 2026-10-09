-- RC436: align the journal schema with posting contracts and add an actor-bound atomic posting RPC.
-- The current production journal tables were empty at the read-only inspection on 2026-10-09.

alter table public.journal_entries add column if not exists entry_number varchar;
alter table public.journal_entries add column if not exists total_debit numeric not null default 0;
alter table public.journal_entries add column if not exists total_credit numeric not null default 0;
alter table public.journal_entries add column if not exists posted_at timestamptz;
alter table public.journal_entry_lines add column if not exists line_number integer;

with line_totals as (
  select journal_entry_id,sum(debit) as total_debit,sum(credit) as total_credit
  from public.journal_entry_lines group by journal_entry_id
)
update public.journal_entries je
set total_debit=coalesce(lt.total_debit,0),
    total_credit=coalesce(lt.total_credit,0),
    posted_at=case when upper(je.status)='POSTED' then coalesce(je.posted_at,je.created_at) else je.posted_at end
from (select je2.id,lt2.total_debit,lt2.total_credit from public.journal_entries je2 left join line_totals lt2 on lt2.journal_entry_id=je2.id) lt
where je.id=lt.id;

with numbered as (
  select id,row_number() over(partition by journal_entry_id order by id)::integer as rn
  from public.journal_entry_lines
)
update public.journal_entry_lines jel
set line_number=numbered.rn
from numbered
where jel.id=numbered.id and jel.line_number is null;

alter table public.journal_entry_lines alter column line_number set default 1;
alter table public.journal_entry_lines alter column line_number set not null;

do $index_guard$
begin
  if exists (
    select 1 from public.journal_entry_lines
    group by journal_entry_id,line_number having count(*)>1
  ) then raise exception 'RC436 blocked: duplicate journal line numbers require reconciliation'; end if;
  if exists (
    select 1 from public.journal_entries
    where entry_number is not null and entry_number<>''
    group by tenant_id,entry_number having count(*)>1
  ) then raise exception 'RC436 blocked: duplicate journal entry numbers require reconciliation'; end if;
end;
$index_guard$;

create unique index if not exists journal_entry_lines_entry_line_uidx
  on public.journal_entry_lines(journal_entry_id,line_number);
create unique index if not exists journal_entries_tenant_entry_number_uidx
  on public.journal_entries(tenant_id,entry_number)
  where entry_number is not null and entry_number<>'';

alter function public.post_financial_journal(jsonb,jsonb) set search_path = '';
alter function public.post_financial_journal_backend(uuid,jsonb,jsonb) set search_path = '';

create or replace function public.post_financial_journal_atomic_backend(
  p_user_id uuid,
  p_entry jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id varchar;
  v_tenant varchar;
  v_entry_number varchar;
  v_business_id uuid;
  v_organization_id varchar;
  v_branch_id varchar;
  v_reference_type varchar;
  v_reference_id varchar;
  v_description text;
  v_entry_date date;
  v_total_debit numeric;
  v_total_credit numeric;
  v_sum_debit numeric := 0;
  v_sum_credit numeric := 0;
  v_line_count integer := 0;
  v_line jsonb;
  v_normalized_lines jsonb := '[]'::jsonb;
  v_line_id varchar;
  v_account varchar;
  v_debit numeric;
  v_credit numeric;
  v_existing public.journal_entries%rowtype;
  v_existing_line public.journal_entry_lines%rowtype;
  v_existing_count integer;
  v_role text;
begin
  if p_user_id is null then raise exception 'JOURNAL_AUTH_REQUIRED'; end if;
  if p_entry is null or pg_catalog.jsonb_typeof(p_entry)<>'object' then raise exception 'JOURNAL_ENTRY_REQUIRED'; end if;
  if coalesce(pg_catalog.jsonb_typeof(p_lines),'null')<>'array'
     or pg_catalog.jsonb_array_length(p_lines)<1
     or pg_catalog.jsonb_array_length(p_lines)>500 then
    raise exception 'JOURNAL_LINES_REQUIRED';
  end if;

  v_id:=nullif(pg_catalog.btrim(p_entry->>'id'),'');
  v_tenant:=nullif(pg_catalog.btrim(p_entry->>'tenant_id'),'');
  v_entry_number:=nullif(pg_catalog.btrim(p_entry->>'entry_number'),'');
  v_organization_id:=nullif(p_entry->>'organization_id','');
  v_business_id:=nullif(p_entry->>'business_id','')::uuid;
  v_branch_id:=nullif(p_entry->>'branch_id','');
  v_reference_type:=nullif(p_entry->>'reference_type','');
  v_reference_id:=nullif(p_entry->>'reference_id','');
  v_description:=coalesce(p_entry->>'description','');
  v_entry_date:=coalesce(nullif(p_entry->>'entry_date','')::date,current_date);
  v_total_debit:=coalesce(nullif(p_entry->>'total_debit','')::numeric,0);
  v_total_credit:=coalesce(nullif(p_entry->>'total_credit','')::numeric,0);

  if v_id is null or length(v_id)>180 then raise exception 'JOURNAL_ID_REQUIRED'; end if;
  if v_tenant is null then raise exception 'TENANT_REQUIRED'; end if;
  if upper(coalesce(p_entry->>'status','POSTED'))<>'POSTED' then raise exception 'ONLY_POSTED_JOURNALS_SUPPORTED'; end if;
  if v_total_debit<=0 or v_total_debit::text in ('NaN','Infinity','-Infinity')
     or v_total_credit<=0 or v_total_credit::text in ('NaN','Infinity','-Infinity')
     or v_total_debit<>v_total_credit then raise exception 'UNBALANCED_JOURNAL'; end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_user_id and m.tenant_id::text=v_tenant and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','SUPER_ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER')
    and (
      v_business_id is null
      or m.business_id=v_business_id
      or (m.business_id is null and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','SUPER_ADMIN'))
    )
  order by m.created_at asc
  limit 1;
  if v_role is null then raise exception 'FINANCIAL_MEMBERSHIP_REQUIRED'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id,0));

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    v_line_count:=v_line_count+1;
    if pg_catalog.jsonb_typeof(v_line)<>'object' then raise exception 'INVALID_JOURNAL_LINE'; end if;
    v_account:=nullif(pg_catalog.btrim(v_line->>'account_id'),'');
    if v_account is null then raise exception 'ACCOUNT_REQUIRED'; end if;
    v_debit:=coalesce(nullif(v_line->>'debit','')::numeric,0);
    v_credit:=coalesce(nullif(v_line->>'credit','')::numeric,0);
    if v_debit::text in ('NaN','Infinity','-Infinity') or v_credit::text in ('NaN','Infinity','-Infinity')
       or v_debit<0 or v_credit<0 then raise exception 'INVALID_LINE_AMOUNT'; end if;
    if (v_debit>0 and v_credit>0) or (v_debit=0 and v_credit=0) then raise exception 'INVALID_LINE_SIDE'; end if;
    if not exists(select 1 from public.chart_of_accounts a where a.id=v_account and a.tenant_id=v_tenant and a.is_active=true) then
      raise exception 'ACCOUNT_NOT_ACTIVE_FOR_TENANT';
    end if;
    v_line_id:=coalesce(nullif(pg_catalog.btrim(v_line->>'id'),''),v_id||'-line-'||v_line_count::text);
    if length(v_line_id)>220 then raise exception 'JOURNAL_LINE_ID_INVALID'; end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(v_normalized_lines) as existing_line(value) where existing_line.value->>'id'=v_line_id) then
      raise exception 'DUPLICATE_JOURNAL_LINE_ID';
    end if;
    v_sum_debit:=v_sum_debit+v_debit;
    v_sum_credit:=v_sum_credit+v_credit;
    v_normalized_lines:=v_normalized_lines||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',v_line_id,'account_id',v_account,'line_number',v_line_count,'debit',v_debit,'credit',v_credit,
      'description',coalesce(v_line->>'description',v_description)
    ));
  end loop;

  if v_sum_debit<>v_total_debit or v_sum_credit<>v_total_credit or v_sum_debit<>v_sum_credit then
    raise exception 'JOURNAL_LINE_TOTAL_MISMATCH';
  end if;

  select * into v_existing from public.journal_entries je where je.id=v_id for update;
  if found then
    if v_existing.tenant_id is distinct from v_tenant
       or v_existing.entry_number is distinct from v_entry_number
       or v_existing.organization_id is distinct from v_organization_id
       or v_existing.business_id is distinct from v_business_id
       or v_existing.branch_id is distinct from v_branch_id
       or v_existing.reference_type is distinct from v_reference_type
       or v_existing.reference_id is distinct from v_reference_id
       or v_existing.description is distinct from v_description
       or v_existing.entry_date is distinct from v_entry_date
       or v_existing.total_debit is distinct from v_total_debit
       or v_existing.total_credit is distinct from v_total_credit
       or v_existing.status<>'POSTED' then
      raise exception 'JOURNAL_IDEMPOTENCY_CONFLICT';
    end if;
    select count(*) into v_existing_count from public.journal_entry_lines jel where jel.journal_entry_id=v_id;
    if v_existing_count<>v_line_count then raise exception 'JOURNAL_IDEMPOTENCY_CONFLICT'; end if;
    for v_line in select value from pg_catalog.jsonb_array_elements(v_normalized_lines) as t(value) loop
      select * into v_existing_line from public.journal_entry_lines jel
      where jel.id=v_line->>'id' and jel.journal_entry_id=v_id;
      if not found
         or v_existing_line.account_id is distinct from v_line->>'account_id'
         or v_existing_line.line_number is distinct from (v_line->>'line_number')::integer
         or v_existing_line.debit is distinct from (v_line->>'debit')::numeric
         or v_existing_line.credit is distinct from (v_line->>'credit')::numeric
         or v_existing_line.description is distinct from v_line->>'description' then
        raise exception 'JOURNAL_IDEMPOTENCY_CONFLICT';
      end if;
      if not exists(select 1 from public.general_ledger gl where gl.journal_line_id=v_existing_line.id and gl.journal_entry_id=v_id) then
        raise exception 'JOURNAL_LEDGER_INCONSISTENT';
      end if;
    end loop;
    return pg_catalog.jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count,'idempotent',true);
  end if;

  insert into public.journal_entries(
    id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
    description,status,total_debit,total_credit,entry_date,posted_at,created_by
  ) values (
    v_id,v_tenant,v_organization_id,v_business_id,v_branch_id,v_entry_number,v_reference_type,v_reference_id,
    v_description,'POSTED',v_total_debit,v_total_credit,v_entry_date,pg_catalog.now(),p_user_id
  );

  for v_line in select value from pg_catalog.jsonb_array_elements(v_normalized_lines) as t(value) loop
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
    values(v_line->>'id',v_id,v_line->>'account_id',(v_line->>'line_number')::integer,
      (v_line->>'debit')::numeric,(v_line->>'credit')::numeric,v_line->>'description');
  end loop;

  insert into public.general_ledger(
    id,tenant_id,business_id,journal_entry_id,journal_line_id,account_id,debit,credit,running_balance,entry_date,posted_at
  )
  select 'gl-'||pg_catalog.gen_random_uuid()::text,v_tenant,v_business_id,v_id,jel.id,jel.account_id,
    jel.debit,jel.credit,jel.debit-jel.credit,v_entry_date,pg_catalog.now()
  from public.journal_entry_lines jel
  where jel.journal_entry_id=v_id;

  return pg_catalog.jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count,'idempotent',false);
end;
$function$;

revoke all on function public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb) to service_role;

comment on function public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb) is
  'RC436: actor-scoped, balanced, idempotent journal posting with atomic journal lines and general ledger writes.';
