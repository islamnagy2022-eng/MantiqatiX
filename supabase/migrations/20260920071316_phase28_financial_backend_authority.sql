CREATE OR REPLACE FUNCTION public.assert_financial_membership(p_tenant_id varchar)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role varchar;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT role INTO v_role FROM public.user_memberships
  WHERE user_id = auth.uid() AND tenant_id = p_tenant_id AND status = 'ACTIVE'
  ORDER BY created_at ASC LIMIT 1;
  IF v_role IS NULL THEN RAISE EXCEPTION 'TENANT_ACCESS_DENIED'; END IF;
  IF upper(v_role) NOT IN ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN RAISE EXCEPTION 'FINANCE_ROLE_REQUIRED'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.post_financial_journal(p_entry jsonb, p_lines jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id varchar := COALESCE(p_entry->>'id', gen_random_uuid()::text); v_tenant varchar := p_entry->>'tenant_id'; v_total_debit numeric := COALESCE((p_entry->>'total_debit')::numeric,0); v_total_credit numeric := COALESCE((p_entry->>'total_credit')::numeric,0); v_line jsonb; v_line_count int := 0;
BEGIN
  PERFORM public.assert_financial_membership(v_tenant);
  IF v_tenant IS NULL OR v_tenant='' THEN RAISE EXCEPTION 'TENANT_REQUIRED'; END IF;
  IF v_total_debit<=0 OR v_total_debit<>v_total_credit THEN RAISE EXCEPTION 'UNBALANCED_JOURNAL'; END IF;
  IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'JOURNAL_LINES_REQUIRED'; END IF;
  INSERT INTO public.journal_entries(id,tenant_id,organization_id,business_id,branch_id,entry_number,reference_type,reference_id,description,status,total_debit,total_credit,entry_date,posted_at,created_by)
  VALUES(v_id,v_tenant,NULLIF(p_entry->>'organization_id',''),NULLIF(p_entry->>'business_id','')::uuid,NULLIF(p_entry->>'branch_id',''),COALESCE(p_entry->>'entry_number',v_id),p_entry->>'reference_type',p_entry->>'reference_id',COALESCE(p_entry->>'description',''),'POSTED',v_total_debit,v_total_credit,COALESCE((p_entry->>'entry_date')::date,CURRENT_DATE),now(),auth.uid())
  ON CONFLICT(id) DO NOTHING;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    INSERT INTO public.journal_entry_lines(id,journal_entry_id,account_id,line_number,debit,credit,description)
    VALUES(COALESCE(v_line->>'id',gen_random_uuid()::text),v_id,v_line->>'account_id',COALESCE((v_line->>'line_number')::int,v_line_count+1),COALESCE((v_line->>'debit')::numeric,0),COALESCE((v_line->>'credit')::numeric,0),v_line->>'description')
    ON CONFLICT(id) DO NOTHING;
    v_line_count:=v_line_count+1;
  END LOOP;
  INSERT INTO public.general_ledger(id,tenant_id,business_id,journal_entry_id,journal_line_id,account_id,debit,credit,running_balance,entry_date,posted_at)
  SELECT gen_random_uuid()::text,v_tenant,je.business_id,je.id,jel.id,jel.account_id,jel.debit,jel.credit,jel.debit-jel.credit,je.entry_date,now()
  FROM public.journal_entries je JOIN public.journal_entry_lines jel ON jel.journal_entry_id=je.id
  WHERE je.id=v_id AND NOT EXISTS(SELECT 1 FROM public.general_ledger gl WHERE gl.journal_line_id=jel.id);
  RETURN jsonb_build_object('id',v_id,'status','POSTED','line_count',v_line_count);
END; $$;

CREATE OR REPLACE FUNCTION public.create_payment_intent_backend(p_tenant_id varchar,p_order_id uuid,p_amount numeric,p_currency varchar,p_provider varchar,p_payment_method varchar,p_idempotency_key varchar)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id varchar;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.user_memberships WHERE user_id=auth.uid() AND tenant_id=p_tenant_id AND status='ACTIVE') THEN RAISE EXCEPTION 'TENANT_ACCESS_DENIED'; END IF;
  IF p_amount<=0 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  INSERT INTO public.payment_intents(id,tenant_id,order_id,amount,currency,status,provider,payment_method,idempotency_key)
  VALUES(gen_random_uuid()::text,p_tenant_id,p_order_id,p_amount,COALESCE(p_currency,'EGP'),'CREATED',p_provider,p_payment_method,p_idempotency_key)
  ON CONFLICT(tenant_id,idempotency_key) DO UPDATE SET updated_at=now()
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id',v_id,'status','CREATED');
END; $$;

CREATE OR REPLACE FUNCTION public.create_settlement_backend(p_tenant_id varchar,p_beneficiary_type varchar,p_beneficiary_id varchar,p_gross numeric,p_platform_fee numeric,p_net numeric,p_voucher numeric,p_channel varchar,p_reference_id varchar)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id varchar:=gen_random_uuid()::text;
BEGIN
  PERFORM public.assert_financial_membership(p_tenant_id);
  IF p_gross<0 OR p_platform_fee<0 OR p_net<0 OR p_voucher<0 THEN RAISE EXCEPTION 'INVALID_SETTLEMENT_AMOUNT'; END IF;
  INSERT INTO public.settlement_transactions(id,tenant_id,beneficiary_type,beneficiary_id,gross_amount,platform_fee,net_payout,voucher_reserve,payout_channel,status,reference_id)
  VALUES(v_id,p_tenant_id,p_beneficiary_type,p_beneficiary_id,p_gross,p_platform_fee,p_net,p_voucher,COALESCE(p_channel,'BANK_TRANSFER'),'PENDING',p_reference_id);
  RETURN jsonb_build_object('id',v_id,'status','PENDING');
END; $$;

REVOKE ALL ON FUNCTION public.assert_financial_membership(varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_financial_journal(jsonb,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payment_intent_backend(varchar,uuid,numeric,varchar,varchar,varchar,varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_settlement_backend(varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_financial_membership(varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_financial_journal(jsonb,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_intent_backend(varchar,uuid,numeric,varchar,varchar,varchar,varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_settlement_backend(varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar) TO authenticated;
