CREATE OR REPLACE FUNCTION public.receive_purchase_stock_backend(
 p_id character varying,
 p_tenant_id character varying,
 p_business_id uuid,
 p_purchase_order_id character varying,
 p_receipt_number character varying,
 p_warehouse_id character varying,
 p_product_id uuid,
 p_received_quantity numeric,
 p_unit_cost numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
 v_user uuid := auth.uid();
 v_role text;
 v_branch character varying;
 v_existing jsonb;
 v_balance stock_balances%ROWTYPE;
 v_receipt erp_purchase_receipts%ROWTYPE;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_received_quantity IS NULL OR p_received_quantity <= 0 OR coalesce(p_unit_cost,0) < 0 THEN RAISE EXCEPTION 'INVALID_RECEIPT_AMOUNT'; END IF;
 IF coalesce(length(trim(p_id)),0) < 8 OR coalesce(length(trim(p_receipt_number)),0) < 1 THEN RAISE EXCEPTION 'INVALID_RECEIPT_REFERENCE'; END IF;
 SELECT role INTO v_role
 FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE'
 LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF','ACCOUNTANT','FINANCE_MANAGER','FINANCE') THEN
   RAISE EXCEPTION 'PURCHASE_RECEIVING_ROLE_REQUIRED';
 END IF;
 SELECT branch_id INTO v_branch
 FROM warehouses
 WHERE id=p_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE';
 IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM catalog_items
   WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE'
 ) THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 SELECT to_jsonb(r) INTO v_existing
 FROM erp_purchase_receipts r
 WHERE r.business_id=p_business_id AND r.receipt_number=p_receipt_number;
 IF v_existing IS NOT NULL THEN
   RETURN jsonb_build_object('success',true,'idempotent',true,'receipt',v_existing);
 END IF;
 SELECT * INTO v_balance
 FROM stock_balances
 WHERE tenant_id=p_tenant_id AND business_id=p_business_id AND warehouse_id=p_warehouse_id AND product_id=p_product_id
 FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
   VALUES('sb-'||gen_random_uuid()::text,p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,p_received_quantity,0)
   RETURNING * INTO v_balance;
 ELSE
   UPDATE stock_balances
   SET quantity_on_hand=quantity_on_hand+p_received_quantity,updated_at=now()
   WHERE id=v_balance.id
   RETURNING * INTO v_balance;
 END IF;
 INSERT INTO erp_purchase_receipts(id,tenant_id,business_id,purchase_order_id,receipt_number,warehouse_id,product_id,received_quantity,unit_cost,status,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_purchase_order_id,p_receipt_number,p_warehouse_id,p_product_id,p_received_quantity,p_unit_cost,'RECEIVED',v_user)
 RETURNING * INTO v_receipt;
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 VALUES('it-'||gen_random_uuid()::text,p_tenant_id,p_business_id,v_branch,p_warehouse_id,p_product_id,'PURCHASE_RECEIPT',p_received_quantity,p_unit_cost,v_receipt.id,v_user);
 RETURN jsonb_build_object('success',true,'idempotent',false,'receipt',to_jsonb(v_receipt),'balance',to_jsonb(v_balance));
END;
$$;
