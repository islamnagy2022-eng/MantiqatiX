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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $function$
declare
  v_id varchar := coalesce(p_entry->>'id', gen_random_uuid()::text);
  v_tenant varchar := p_entry->>'tenant_id';
  v_total_debit numeric := coalesce((p_entry->>'total_debit')::numeric,0);
  v_total_credit numeric := coalesce((p_entry->>'total_credit')::numeric,0);
  v_line jsonb; v_line_count int := 0; v_line_debit numeric := 0; v_line_credit numeric := 0;
  v_account varchar; v_role text; v_insert_line_no int := 0;
  v_business_id uuid := nullif(p_entry->>'business_id','')::uuid;
  v_branch_id varchar := nullif(p_entry->>'branch_id','');
  v_org_id varchar := nullif(p_entry->>'organization_id',''); v_business_org_id varchar;
begin
  if p_user_id is null or (coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' and p_user_id <> auth.uid()) then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if v_tenant is null or v_tenant='' then raise exception 'TENANT_REQUIRED'; end if;
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
  select upper(um.role) into v_role from public.user_memberships um
  where um.user_id=p_user_id and um.tenant_id::text=v_tenant and um.status='ACTIVE'
    and (um.business_id is null or um.business_id=v_business_id)
    and (um.branch_id is null or um.branch_id=v_branch_id)
    and (um.organization_id is null or um.organization_id=v_org_id)
    and upper(um.role)=any(array['OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE','FINANCE_MANAGER']) limit 1;
  if v_role is null then raise exception 'FINANCIAL_MEMBERSHIP_REQUIRED'; end if;
  if v_total_debit<=0 or v_total_debit<>v_total_credit then raise exception 'UNBALANCED_JOURNAL'; end if;
  if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'JOURNAL_LINES_REQUIRED'; end if;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_account:=v_line->>'account_id';
    if v_account is null or v_account='' then raise exception 'ACCOUNT_REQUIRED'; end if;
    if coalesce((v_line->>'debit')::numeric,0)<0 or coalesce((v_line->>'credit')::numeric,0)<0 then raise exception 'NEGATIVE_LINE_AMOUNT'; end if;
    if coalesce((v_line->>'debit')::numeric,0)>0 and coalesce((v_line->>'credit')::numeric,0)>0 then raise exception 'LINE_CANNOT_HAVE_BOTH_DEBIT_AND_CREDIT'; end if;
    if not exists(select 1 from public.chart_of_accounts c where c.id=v_account and c.tenant_id=v_tenant and c.is_active=true) then raise exception 'ACCOUNT_NOT_ACTIVE_FOR_TENANT'; end if;
    v_line_debit:=v_line_debit+coalesce((v_line->>'debit')::numeric,0); v_line_credit:=v_line_credit+coalesce((v_line->>'credit')::numeric,0); v_line_count:=v_line_count+1;
  end loop;
  if v_line_count=0 or v_line_debit<=0 or v_line_debit<>v_total_debit or v_line_credit<>v_total_credit or v_line_debit<>v_line_credit then raise exception 'JOURNAL_LINE_TOTAL_MISMATCH'; end if;

  -- Serialize the journal ID and fail closed on replay; silently ignoring a header conflict
  -- while inserting new lines can corrupt the ledger.
  perform pg_advisory_xact_lock(hashtextextended(v_id, 0));
  if exists(select 1 from public.journal_entries where id=v_id) then
    raise exception 'JOURNAL_ID_ALREADY_EXISTS';
  end if;
  insert into public.journal_entries(id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,description,status,total_debit,total_credit,entry_date,posted_at,created_by)
  values(v_id,v_tenant,v_org_id,nullif(p_entry->>'business_id','')::uuid,nullif(p_entry->>'branch_id',''),coalesce(p_entry->>'entry_number',v_id),p_entry->>'reference_type',p_entry->>'reference_id',coalesce(p_entry->>'description',''),'DRAFT',v_total_debit,v_total_credit,coalesce((p_entry->>'entry_date')::date,current_date),clock_timestamp(),p_user_id);

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_insert_line_no := v_insert_line_no + 1;
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
    values(coalesce(v_line->>'id',gen_random_uuid()::text),v_id,v_line->>'account_id',coalesce((v_line->>'line_number')::int,v_insert_line_no),coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0),v_line->>'description');

  end loop;
  update public.journal_entries
  set status='POSTED',posted_at=clock_timestamp()
  where id=v_id and tenant_id=v_tenant and status='DRAFT';
  if not found then raise exception 'JOURNAL_POST_TRANSITION_FAILED'; end if;
  return jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count);
end;
$function$;

revoke all on function public.post_financial_journal_backend(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.post_financial_journal_backend(uuid,jsonb,jsonb) to service_role;