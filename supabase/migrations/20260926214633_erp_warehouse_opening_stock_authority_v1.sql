CREATE OR REPLACE FUNCTION public.create_warehouse_backend(
  p_id character varying,
  p_tenant_id character varying,
  p_business_id uuid,
  p_name character varying,
  p_code character varying
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_name)),0)<1 OR coalesce(length(trim(p_code)),0)<1 THEN RAISE EXCEPTION 'INVALID_WAREHOUSE_INPUT'; END IF;
 SELECT role INTO v_role FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER') THEN RAISE EXCEPTION 'WAREHOUSE_ADMIN_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM businesses WHERE id=p_business_id AND tenant_id=p_tenant_id AND status='ACTIVE') THEN RAISE EXCEPTION 'BUSINESS_INVALID'; END IF;
 INSERT INTO warehouses(id,tenant_id,business_id,name,code,status)
 VALUES(p_id,p_tenant_id,p_business_id,p_name,p_code,'ACTIVE')
 ON CONFLICT(id) DO NOTHING;
 SELECT to_jsonb(w) INTO v_row FROM warehouses w WHERE w.id=p_id;
 RETURN jsonb_build_object('success',true,'warehouse',v_row);
END; $$;

REVOKE ALL ON FUNCTION public.create_warehouse_backend(character varying,character varying,uuid,character varying,character varying) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_warehouse_backend(character varying,character varying,uuid,character varying,character varying) TO authenticated;

CREATE OR REPLACE FUNCTION public.initialize_opening_stock_backend(
  p_id character varying,
  p_tenant_id character varying,
  p_business_id uuid,
  p_warehouse_id character varying,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric,
  p_reference_id character varying
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_branch character varying; v_balance stock_balances%ROWTYPE; v_existing jsonb; v_tx_id character varying;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 OR coalesce(p_unit_cost,0)<0 THEN RAISE EXCEPTION 'INVALID_OPENING_STOCK'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_reference_id)),0)<1 THEN RAISE EXCEPTION 'INVALID_OPENING_STOCK_REFERENCE'; END IF;
 SELECT role INTO v_role FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN RAISE EXCEPTION 'OPENING_STOCK_ROLE_REQUIRED'; END IF;
 SELECT branch_id INTO v_branch FROM warehouses WHERE id=p_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM catalog_items WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 SELECT to_jsonb(i) INTO v_existing FROM inventory_transactions i
 WHERE i.tenant_id=p_tenant_id AND i.business_id=p_business_id AND i.warehouse_id=p_warehouse_id AND i.product_id=p_product_id
   AND i.transaction_type='OPENING' AND i.reference_id=p_reference_id LIMIT 1;
 IF v_existing IS NOT NULL THEN RETURN jsonb_build_object('success',true,'idempotent',true,'transaction',v_existing); END IF;
 SELECT * INTO v_balance FROM stock_balances
 WHERE tenant_id=p_tenant_id AND business_id=p_business_id AND warehouse_id=p_warehouse_id AND product_id=p_product_id FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
   VALUES(p_id||'-balance',p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,p_quantity,0)
   RETURNING * INTO v_balance;
 ELSE
   UPDATE stock_balances SET quantity_on_hand=quantity_on_hand+p_quantity,updated_at=now() WHERE id=v_balance.id RETURNING * INTO v_balance;
 END IF;
 v_tx_id := p_id||'-tx';
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 VALUES(v_tx_id,p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,'OPENING',p_quantity,p_unit_cost,p_reference_id,v_user);
 RETURN jsonb_build_object('success',true,'idempotent',false,'transaction',to_jsonb((SELECT i FROM inventory_transactions i WHERE i.id=v_tx_id)),'balance',to_jsonb(v_balance));
END; $$;

REVOKE ALL ON FUNCTION public.initialize_opening_stock_backend(character varying,character varying,uuid,character varying,uuid,numeric,numeric,character varying) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.initialize_opening_stock_backend(character varying,character varying,uuid,character varying,uuid,numeric,numeric,character varying) TO authenticated;
