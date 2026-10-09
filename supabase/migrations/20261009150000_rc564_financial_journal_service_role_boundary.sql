-- RC564: the verified Edge Function supplies p_user_id after validating the bearer token.
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
  v_account varchar; v_role text;
begin
  if p_user_id is null or (coalesce(auth.role(),'') <> 'service_role' and p_user_id <> auth.uid()) then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if v_tenant is null or v_tenant='' then raise exception 'TENANT_REQUIRED'; end if;
  select upper(um.role) into v_role from public.user_memberships um
  where um.user_id=p_user_id and um.tenant_id::text=v_tenant and um.status='ACTIVE'
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
  insert into public.journal_entries(id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,description,status,total_debit,total_credit,entry_date,posted_at,created_by)
  values(v_id,v_tenant,nullif(p_entry->>'organization_id',''),nullif(p_entry->>'business_id','')::uuid,nullif(p_entry->>'branch_id',''),coalesce(p_entry->>'entry_number',v_id),p_entry->>'reference_type',p_entry->>'reference_id',coalesce(p_entry->>'description',''),'POSTED',v_total_debit,v_total_credit,coalesce((p_entry->>'entry_date')::date,current_date),now(),p_user_id)
  on conflict(id) do nothing;
  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
    values(coalesce(v_line->>'id',gen_random_uuid()::text),v_id,v_line->>'account_id',coalesce((v_line->>'line_number')::int,v_line_count+1),coalesce((v_line->>'debit')::numeric,0),coalesce((v_line->>'credit')::numeric,0),v_line->>'description')
    on conflict(id) do nothing;
  end loop;
  insert into public.general_ledger(id,tenant_id,business_id,journal_entry_id,journal_line_id,account_id,debit,credit,running_balance,entry_date,posted_at)
  select gen_random_uuid()::text,v_tenant,je.business_id,je.id,jel.id,jel.account_id,jel.debit,jel.credit,jel.debit-jel.credit,je.entry_date,now()
  from public.journal_entries je join public.journal_entry_lines jel on jel.journal_entry_id=je.id
  where je.id=v_id and not exists(select 1 from public.general_ledger gl where gl.journal_line_id=jel.id);
  return jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count);
end;
$function$;

revoke all on function public.post_financial_journal_backend(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.post_financial_journal_backend(uuid,jsonb,jsonb) to service_role;