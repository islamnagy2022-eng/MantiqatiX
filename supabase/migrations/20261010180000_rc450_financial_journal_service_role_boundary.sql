-- RC450 requires the journal, business, and branch schema; fail clearly if the migration order/schema is incomplete.
do $rc450_preflight$
begin
  if to_regclass('public.businesses') is null or to_regclass('public.branches') is null then
    raise exception 'RC450 prerequisite missing: businesses or branches table is absent';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.journal_entries'::regclass
      and attname='entry_number' and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.journal_entries'::regclass
      and attname='total_debit' and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.journal_entries'::regclass
      and attname='total_credit' and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.journal_entries'::regclass
      and attname='posted_at' and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid='public.journal_entry_lines'::regclass
      and attname='line_number' and not attisdropped
  ) then
    raise exception 'RC450 prerequisite missing: required journal schema columns are absent; apply the approved journal schema migration first';
  end if;
end;
$rc450_preflight$;

-- Post only after journal lines exist. Serialize by tenant/account and maintain a true cumulative balance.
create or replace function public.trg_post_journal_to_general_ledger()
returns trigger
language plpgsql
set search_path = ''
as $trigger$
declare
  r_line record;
  v_account varchar;
  v_running numeric(14,4);
  v_account_balances jsonb := '{}'::jsonb;
begin
  if new.status='POSTED' and (tg_op='INSERT' or old.status is distinct from 'POSTED') then
    for v_account in
      select distinct jel.account_id from public.journal_entry_lines jel
      where jel.journal_entry_id=new.id order by jel.account_id
    loop
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.tenant_id || ':' || v_account, 0));
    end loop;
    for r_line in
      select jel.* from public.journal_entry_lines jel
      where jel.journal_entry_id=new.id order by jel.line_number asc
    loop
      if v_account_balances ? r_line.account_id then
        v_running := (v_account_balances ->> r_line.account_id)::numeric;
      else
        select coalesce(gl.running_balance,0) into v_running
        from public.general_ledger gl
        where gl.tenant_id=new.tenant_id and gl.account_id=r_line.account_id
        order by gl.posted_at desc,gl.id desc limit 1;
        v_running := coalesce(v_running,0);
      end if;
      v_running := v_running + (r_line.debit-r_line.credit);
      v_account_balances := pg_catalog.jsonb_set(v_account_balances,array[r_line.account_id],pg_catalog.to_jsonb(v_running),true);
      insert into public.general_ledger(id,tenant_id,business_id,journal_entry_id,journal_line_id,account_id,debit,credit,running_balance,entry_date,posted_at)
      values('gl_' || substring(replace(pg_catalog.gen_random_uuid()::text,'-',''),1,16),new.tenant_id,new.business_id,new.id,r_line.id,r_line.account_id,r_line.debit,r_line.credit,v_running,new.entry_date,new.posted_at);
    end loop;
  end if;
  return new;
end;
$trigger$;

drop trigger if exists trg_post_journal_to_gl on public.journal_entries;
create trigger trg_post_journal_to_gl after insert or update on public.journal_entries
for each row execute function public.trg_post_journal_to_general_ledger();

-- RC450: the verified Edge Function supplies p_user_id after validating the bearer token.
-- The RPC remains service_role-only; actor membership is revalidated in the function body.
create or replace function public.post_financial_journal_backend(
  p_user_id uuid, p_entry jsonb, p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id varchar := nullif(pg_catalog.btrim(p_entry->>'id'),'');
  v_tenant varchar := nullif(pg_catalog.btrim(p_entry->>'tenant_id'),'');
  v_entry_number varchar;
  v_reference_type varchar := nullif(p_entry->>'reference_type','');
  v_reference_id varchar := nullif(p_entry->>'reference_id','');
  v_description text := coalesce(p_entry->>'description','');
  v_entry_date date := coalesce(nullif(p_entry->>'entry_date','')::date,current_date);
  v_total_debit numeric := coalesce(nullif(p_entry->>'total_debit','')::numeric,0);
  v_total_credit numeric := coalesce(nullif(p_entry->>'total_credit','')::numeric,0);
  v_line jsonb;
  v_line_count int := 0;
  v_insert_line_no int := 0;
  v_line_debit numeric := 0;
  v_line_credit numeric := 0;
  v_account varchar;
  v_line_id varchar;
  v_line_number int;
  v_debit numeric;
  v_credit numeric;
  v_line_description text;
  v_role text;
  v_business_id uuid := nullif(p_entry->>'business_id','')::uuid;
  v_branch_id varchar := nullif(p_entry->>'branch_id','');
  v_org_id varchar := nullif(p_entry->>'organization_id','');
  v_business_org_id varchar;
  v_normalized_lines jsonb := '[]'::jsonb;
  v_existing public.journal_entries%rowtype;
  v_existing_line public.journal_entry_lines%rowtype;
  v_existing_count int;
begin
  if p_user_id is null or (
    coalesce(pg_catalog.current_setting('request.jwt.claim.role', true),'') <> 'service_role'
    and p_user_id <> auth.uid()
  ) then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_entry is null or pg_catalog.jsonb_typeof(p_entry)<>'object' then raise exception 'JOURNAL_ENTRY_REQUIRED'; end if;
  if v_id is null or pg_catalog.length(v_id)>180 then raise exception 'JOURNAL_ID_REQUIRED'; end if;
  if v_tenant is null or v_tenant='' then raise exception 'TENANT_REQUIRED'; end if;
  if upper(coalesce(p_entry->>'status','POSTED'))<>'POSTED' then raise exception 'ONLY_POSTED_JOURNALS_SUPPORTED'; end if;
  if p_lines is null or pg_catalog.jsonb_typeof(p_lines)<>'array'
     or pg_catalog.jsonb_array_length(p_lines)<1 or pg_catalog.jsonb_array_length(p_lines)>500 then
    raise exception 'JOURNAL_LINES_REQUIRED';
  end if;
  v_entry_number := coalesce(nullif(pg_catalog.btrim(p_entry->>'entry_number'),''),v_id);

  if v_total_debit<=0 or v_total_debit::text in ('NaN','Infinity','-Infinity')
     or v_total_credit<=0 or v_total_credit::text in ('NaN','Infinity','-Infinity')
     or v_total_debit<>v_total_credit then raise exception 'UNBALANCED_JOURNAL'; end if;

  if v_business_id is not null then
    select b.organization_id into v_business_org_id
    from public.businesses b
    where b.id=v_business_id and b.tenant_id=v_tenant and upper(b.status)='ACTIVE';
    if not found then raise exception 'BUSINESS_NOT_ACTIVE_FOR_TENANT'; end if;
    if v_org_id is not null and v_org_id is distinct from v_business_org_id then
      raise exception 'BUSINESS_ORGANIZATION_MISMATCH';
    end if;
    v_org_id := coalesce(v_org_id,v_business_org_id);
  end if;
  if v_branch_id is not null and (
    v_business_id is null or not exists(
      select 1 from public.branches b
      where b.id=v_branch_id and b.tenant_id=v_tenant and b.business_id=v_business_id
        and upper(b.status)='ACTIVE'
    )
  ) then raise exception 'BRANCH_NOT_ACTIVE_FOR_BUSINESS'; end if;

  select upper(um.role) into v_role
  from public.user_memberships um
  where um.user_id=p_user_id and um.tenant_id::text=v_tenant and um.status='ACTIVE'
    and (um.business_id is null or um.business_id=v_business_id)
    and (um.branch_id is null or um.branch_id=v_branch_id)
    and (um.organization_id is null or um.organization_id=v_org_id)
    and upper(um.role)=any(array['OWNER','BUSINESS_OWNER','ADMIN','SUPER_ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER'])
  order by um.created_at asc
  limit 1;
  if v_role is null then raise exception 'FINANCIAL_MEMBERSHIP_REQUIRED'; end if;

  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) as t(value) loop
    v_line_count:=v_line_count+1;
    v_insert_line_no:=v_insert_line_no+1;
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
    v_line_id:=coalesce(nullif(pg_catalog.btrim(v_line->>'id'),''),v_id||'-line-'||v_insert_line_no::text);
    v_line_number:=coalesce(nullif(v_line->>'line_number','')::int,v_insert_line_no);
    v_line_description:=coalesce(v_line->>'description',v_description);
    if pg_catalog.length(v_line_id)>220 or v_line_number<1 then raise exception 'JOURNAL_LINE_ID_INVALID'; end if;
    if exists(select 1 from pg_catalog.jsonb_array_elements(v_normalized_lines) as prior(value)
      where prior.value->>'id'=v_line_id or (prior.value->>'line_number')::int=v_line_number) then
      raise exception 'DUPLICATE_JOURNAL_LINE_ID';
    end if;
    v_line_debit:=v_line_debit+v_debit;
    v_line_credit:=v_line_credit+v_credit;
    v_normalized_lines:=v_normalized_lines||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',v_line_id,'account_id',v_account,'line_number',v_line_number,
      'debit',v_debit,'credit',v_credit,'description',v_line_description
    ));
  end loop;
  if v_line_count=0 or v_line_debit<=0 or v_line_debit<>v_total_debit
     or v_line_credit<>v_total_credit or v_line_debit<>v_line_credit then
    raise exception 'JOURNAL_LINE_TOTAL_MISMATCH';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_id,0));
  select * into v_existing from public.journal_entries je where je.id=v_id for update;
  if found then
    if v_existing.tenant_id is distinct from v_tenant
       or v_existing.entry_number is distinct from v_entry_number
       or v_existing.organization_id is distinct from v_org_id
       or v_existing.business_id is distinct from v_business_id
       or v_existing.branch_id is distinct from v_branch_id
       or v_existing.reference_type is distinct from v_reference_type
       or v_existing.reference_id is distinct from v_reference_id
       or v_existing.description is distinct from v_description
       or v_existing.entry_date is distinct from v_entry_date
       or v_existing.total_debit is distinct from v_total_debit
       or v_existing.total_credit is distinct from v_total_credit
       or v_existing.created_by is distinct from p_user_id
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
         or v_existing_line.line_number is distinct from (v_line->>'line_number')::int
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
    v_id,v_tenant,v_org_id,v_business_id,v_branch_id,v_entry_number,v_reference_type,v_reference_id,
    v_description,'DRAFT',v_total_debit,v_total_credit,v_entry_date,pg_catalog.clock_timestamp(),p_user_id
  );

  for v_line in select value from pg_catalog.jsonb_array_elements(v_normalized_lines) as t(value) loop
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
    values(v_line->>'id',v_id,v_line->>'account_id',(v_line->>'line_number')::int,
      (v_line->>'debit')::numeric,(v_line->>'credit')::numeric,v_line->>'description');
  end loop;

  update public.journal_entries
  set status='POSTED',posted_at=pg_catalog.clock_timestamp()
  where id=v_id and tenant_id=v_tenant and status='DRAFT';
  if not found then raise exception 'JOURNAL_POST_TRANSITION_FAILED'; end if;
  return pg_catalog.jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count,'idempotent',false);
end;
$function$;
revoke all on function public.post_financial_journal_backend(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.post_financial_journal_backend(uuid,jsonb,jsonb) to service_role;

-- The canonical service-role entrypoint is post_financial_journal_backend; remove the earlier parallel implementation.
revoke all on function public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb) from public, anon, authenticated, service_role;
drop function public.post_financial_journal_atomic_backend(uuid,jsonb,jsonb);