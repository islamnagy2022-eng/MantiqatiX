-- RC238: fix atomic settlement journal posting order and GL duplication
create or replace function public.create_settlement_and_post_journal(
  p_id character varying, p_tenant_id character varying, p_beneficiary_type character varying,
  p_beneficiary_id character varying, p_gross numeric, p_platform_fee numeric, p_net numeric,
  p_voucher numeric, p_channel character varying, p_reference_id character varying,
  p_business_id uuid default null, p_description text default null, p_actor_user_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public'
as $function$
declare
  v_existing public.settlement_transactions%rowtype;
  v_je_id varchar := 'je_' || p_id;
  v_account_2010 varchar; v_account_1020 varchar; v_account_2050 varchar; v_account_5030 varchar;
  v_total numeric; v_line_count integer := 0; v_role varchar;
begin
  if p_actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  select role into v_role from public.user_memberships
  where user_id=p_actor_user_id and tenant_id=p_tenant_id and status='ACTIVE'
  order by created_at asc limit 1;
  if v_role is null then raise exception 'TENANT_ACCESS_DENIED'; end if;
  if upper(v_role) not in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') then
    raise exception 'FINANCE_ROLE_REQUIRED';
  end if;
  if p_id is null or p_id='' or p_tenant_id is null or p_tenant_id='' then raise exception 'SETTLEMENT_ID_AND_TENANT_REQUIRED'; end if;
  if p_beneficiary_type not in ('PARTNER','MERCHANT') then raise exception 'INVALID_BENEFICIARY_TYPE'; end if;
  if p_beneficiary_id is null or p_beneficiary_id='' then raise exception 'BENEFICIARY_REQUIRED'; end if;
  if p_gross < 0 or p_platform_fee < 0 or p_net < 0 or p_voucher < 0 then raise exception 'INVALID_SETTLEMENT_AMOUNT'; end if;
  if round(p_gross,2) <> round(p_platform_fee+p_net+p_voucher,2) then raise exception 'SETTLEMENT_BREAKDOWN_MISMATCH'; end if;
  if p_beneficiary_type='PARTNER' and round(p_net+p_voucher,2)<>round(p_gross,2) then raise exception 'PARTNER_SETTLEMENT_MUST_EQUAL_GROSS'; end if;
  if p_beneficiary_type='MERCHANT' and p_voucher<>0 then raise exception 'MERCHANT_VOUCHER_MUST_BE_ZERO'; end if;

  select * into v_existing from public.settlement_transactions where id=p_id for update;
  if found and v_existing.status='SETTLED' and v_existing.journal_entry_id is not null then
    return jsonb_build_object('id',p_id,'status',v_existing.status,'journalEntryId',v_existing.journal_entry_id,'idempotent',true);
  end if;

  select id into v_account_2010 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='2010' and is_active=true limit 1;
  select id into v_account_1020 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='1020' and is_active=true limit 1;
  select id into v_account_2050 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='2050' and is_active=true limit 1;
  select id into v_account_5030 from public.chart_of_accounts where tenant_id=p_tenant_id and account_code='5030' and is_active=true limit 1;
  if v_account_1020 is null then raise exception 'COA_1020_MISSING'; end if;
  if p_beneficiary_type='MERCHANT' and v_account_2010 is null then raise exception 'COA_2010_MISSING'; end if;
  if p_beneficiary_type='PARTNER' and (v_account_2050 is null or v_account_5030 is null) then raise exception 'COA_PARTNER_ACCOUNTS_MISSING'; end if;

  v_total := case when p_beneficiary_type='PARTNER' then p_gross else p_net end;
  if v_total<=0 then raise exception 'SETTLEMENT_TOTAL_MUST_BE_POSITIVE'; end if;

  insert into public.journal_entries(
    id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,
    description,status,total_debit,total_credit,entry_date,posted_at,created_by
  ) values(
    v_je_id,p_tenant_id,null,p_business_id,null,'JE-'||p_id,
    case when p_beneficiary_type='PARTNER' then 'PARTNER_COMMISSION_SETTLEMENT' else 'ORDER_SETTLEMENT' end,
    coalesce(p_reference_id,p_id),coalesce(p_description,'Atomic settlement '||p_id),'DRAFT',
    0,0,current_date,null,p_actor_user_id
  ) on conflict(id) do nothing;

  if p_beneficiary_type='PARTNER' then
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description) values
      ('jel_'||p_id||'_5030',v_je_id,v_account_5030,1,p_gross,0,'Partner commission expense'),
      ('jel_'||p_id||'_1020',v_je_id,v_account_1020,2,0,p_net,'Partner cash payout'),
      ('jel_'||p_id||'_2050',v_je_id,v_account_2050,3,0,p_voucher,'Partner voucher reserve')
    on conflict(id) do nothing;
    v_line_count:=3;
  else
    insert into public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description) values
      ('jel_'||p_id||'_2010',v_je_id,v_account_2010,1,p_net,0,'Close merchant payable'),
      ('jel_'||p_id||'_1020',v_je_id,v_account_1020,2,0,p_net,'Merchant cash payout')
    on conflict(id) do nothing;
    v_line_count:=2;
  end if;

  update public.journal_entries
  set status='POSTED', total_debit=v_total, total_credit=v_total, posted_at=now()
  where id=v_je_id;

  if not exists (select 1 from public.general_ledger gl where gl.journal_entry_id=v_je_id) then
    raise exception 'GENERAL_LEDGER_POSTING_FAILED';
  end if;

  if v_existing.id is null then
    insert into public.settlement_transactions(
      id,tenant_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,
      payout_channel,journal_entry_id,status,reference_id
    ) values(
      p_id,p_tenant_id,p_beneficiary_type,p_beneficiary_id,p_gross,p_platform_fee,p_net,p_voucher,
      coalesce(p_channel,'BANK_TRANSFER'),v_je_id,'SETTLED',p_reference_id
    );
  else
    update public.settlement_transactions
    set gross_amount=p_gross,platform_fee=p_platform_fee,net_payout=p_net,voucher_reserve=p_voucher,
        payout_channel=coalesce(p_channel,payout_channel),journal_entry_id=v_je_id,status='SETTLED',reference_id=p_reference_id
    where id=p_id;
  end if;

  return jsonb_build_object('id',p_id,'status','SETTLED','journalEntryId',v_je_id,'lineCount',v_line_count,'idempotent',false);
end;
$function$;
