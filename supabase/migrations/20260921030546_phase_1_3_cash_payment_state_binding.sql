CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_intent_id character varying,p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_payment_intent_id uuid; v_intent record; v_order record; v_membership record; v_rule record;
v_commission_amount numeric:=0; v_user_role text; v_is_authorized boolean:=false; v_event_id text; v_obligation_id text;
BEGIN
 v_payment_intent_id:=p_payment_intent_id::uuid;
 IF auth.uid() IS NOT NULL AND auth.uid()<>p_user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO v_intent FROM public.payment_intents WHERE id=v_payment_intent_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_INTENT_NOT_FOUND'; END IF;
 SELECT * INTO v_order FROM public.orders WHERE id=v_intent.order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF v_intent.status='SUCCEEDED' THEN
   RETURN jsonb_build_object('status','success','message','Already confirmed','payment_intent',to_jsonb(v_intent),'order',to_jsonb(v_order));
 END IF;
 IF v_intent.status NOT IN ('CREATED','PENDING') THEN RAISE EXCEPTION 'INVALID_PAYMENT_STATE'; END IF;
 IF v_order.status='CANCELLED' THEN RAISE EXCEPTION 'ORDER_CANCELLED'; END IF;
 IF v_intent.payment_method<>'CASH_ON_DELIVERY' THEN RAISE EXCEPTION 'INVALID_METHOD'; END IF;
 IF v_intent.tenant_id::text<>v_order.tenant_id::text THEN RAISE EXCEPTION 'TENANT_MISMATCH'; END IF;
 IF v_intent.pricing_hash IS NULL OR v_order.pricing_hash IS NULL OR v_intent.pricing_hash<>v_order.pricing_hash
    OR v_intent.pricing_version IS DISTINCT FROM v_order.pricing_version THEN RAISE EXCEPTION 'PRICING_BINDING_MISMATCH'; END IF;
 IF v_intent.amount<>v_order.total OR v_intent.currency<>v_order.currency THEN RAISE EXCEPTION 'FINANCIAL_MISMATCH'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.tenant_payment_methods tpm WHERE tpm.tenant_id=v_intent.tenant_id::text AND tpm.payment_method='CASH_ON_DELIVERY' AND tpm.provider=v_intent.provider AND tpm.is_enabled=true)
 THEN RAISE EXCEPTION 'INVALID_PROVIDER'; END IF;
 SELECT role,permissions,status INTO v_membership FROM public.user_memberships WHERE user_id=p_user_id AND tenant_id=v_intent.tenant_id;
 IF NOT FOUND OR (v_membership.status IS NOT NULL AND v_membership.status<>'ACTIVE') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 v_user_role:=coalesce(v_membership.role,'CUSTOMER');
 v_is_authorized:=(upper(v_user_role) in ('ADMIN','MANAGER','CASHIER','STAFF','OWNER') OR (coalesce(v_membership.permissions,'{}'::jsonb)?'PAYMENT_CONFIRM_CASH')) AND upper(v_user_role)<>'CUSTOMER';
 IF NOT v_is_authorized THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT cr.id,cr.rule_type,cr.percentage,cr.fixed_amount,cr.per_item_amount INTO v_rule
 FROM public.commission_rules cr WHERE cr.tenant_id=v_intent.tenant_id AND cr.active=true
 AND (cr.business_id=v_order.business_id OR cr.business_id IS NULL)
 ORDER BY CASE WHEN cr.business_id=v_order.business_id THEN 0 ELSE 1 END,cr.updated_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'COMMISSION_RULE_NOT_CONFIGURED'; END IF;
 IF upper(coalesce(v_rule.rule_type,'PERCENTAGE'))='PERCENTAGE' THEN
   IF coalesce(v_rule.percentage,0)<0 OR coalesce(v_rule.percentage,0)>100 THEN RAISE EXCEPTION 'COMMISSION_RULE_INVALID'; END IF;
   v_commission_amount:=round(v_intent.amount*coalesce(v_rule.percentage,0)/100,2);
 ELSIF upper(v_rule.rule_type)='FIXED' THEN v_commission_amount:=greatest(0,coalesce(v_rule.fixed_amount,0));
 ELSE RAISE EXCEPTION 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_CASH'; END IF;
 IF v_commission_amount>v_intent.amount THEN RAISE EXCEPTION 'COMMISSION_EXCEEDS_ORDER'; END IF;
 UPDATE public.payment_intents SET status='SUCCEEDED',updated_at=now() WHERE id=v_payment_intent_id;
 v_event_id:='cash_confirmed:'||v_payment_intent_id::text;
 INSERT INTO public.payment_events(id,tenant_id,event_id,payment_id,amount,payment_method,status,raw_payload,created_at)
 VALUES(gen_random_uuid(),v_intent.tenant_id,v_event_id,p_payment_intent_id,v_intent.amount,'CASH_ON_DELIVERY','PROCESSED',
 jsonb_build_object('action','CASH_CONFIRMED','confirmed_by',p_user_id,'previous_status',v_intent.status,'new_status','SUCCEEDED','commission_amount',v_commission_amount,'commission_rule_id',v_rule.id,'timestamp',now()),now())
 ON CONFLICT(event_id) DO NOTHING;
 v_obligation_id:='cash_commission:'||v_payment_intent_id::text;
 INSERT INTO public.financial_obligations(id,tenant_id,business_id,order_id,payment_intent_id,beneficiary_type,beneficiary_id,obligation_type,gross_amount,amount,currency,status,payment_method,metadata)
 VALUES(v_obligation_id,v_intent.tenant_id,v_order.business_id,v_order.id,v_intent.id::text,'PLATFORM','PLATFORM','PLATFORM_COMMISSION',v_intent.amount,v_commission_amount,v_intent.currency,'DUE','CASH',
 jsonb_build_object('reason','CUSTOMER_PAID_PROVIDER_DIRECTLY','commission_rule_id',v_rule.id,'commission_rate',coalesce(v_rule.percentage,0),'confirmed_by',p_user_id))
 ON CONFLICT(id) DO NOTHING;
 SELECT * INTO v_intent FROM public.payment_intents WHERE id=v_payment_intent_id;
 RETURN jsonb_build_object('status','success','payment_intent',to_jsonb(v_intent),'order',to_jsonb(v_order),
 'commission_obligation',jsonb_build_object('id',v_obligation_id,'amount',v_commission_amount,'status','DUE'));
END; $$;
