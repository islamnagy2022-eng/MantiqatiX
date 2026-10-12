CREATE OR REPLACE FUNCTION public.transfer_inventory_backend(
  p_tenant_id uuid,
  p_business_id uuid,
  p_source_warehouse_id uuid,
  p_target_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_source stock_balances%ROWTYPE;
  v_target stock_balances%ROWTYPE;
  v_response jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  IF p_source_warehouse_id = p_target_warehouse_id THEN RAISE EXCEPTION 'SAME_WAREHOUSE'; END IF;
  IF coalesce(length(trim(p_idempotency_key)),0) < 8 OR length(p_idempotency_key) > 128 THEN RAISE EXCEPTION 'INVALID_IDEMPOTENCY_KEY'; END IF;

  SELECT um.role INTO v_role
  FROM user_memberships um
  WHERE um.user_id=v_user AND um.tenant_id=p_tenant_id AND um.business_id=p_business_id AND um.status='ACTIVE'
  ORDER BY CASE WHEN upper(um.role) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER') THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN
    RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED';
  END IF;

  SELECT response INTO v_response
  FROM legacy_module_idempotency
  WHERE module_code='ERP_INVENTORY_TRANSFER' AND actor_user_id=v_user AND idempotency_key=p_idempotency_key;
  IF v_response IS NOT NULL THEN RETURN v_response; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses w
    WHERE w.id=p_source_warehouse_id AND w.tenant_id=p_tenant_id AND w.business_id=p_business_id AND w.status='ACTIVE'
  ) THEN RAISE EXCEPTION 'SOURCE_WAREHOUSE_INVALID'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses w
    WHERE w.id=p_target_warehouse_id AND w.tenant_id=p_tenant_id AND w.business_id=p_business_id AND w.status='ACTIVE'
  ) THEN RAISE EXCEPTION 'TARGET_WAREHOUSE_INVALID'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.id=p_product_id AND p.tenant_id=p_tenant_id AND p.business_id=p_business_id AND p.deleted_at IS NULL AND p.status='ACTIVE'
  ) THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;

  SELECT * INTO v_source
  FROM stock_balances
  WHERE tenant_id=p_tenant_id AND business_id=p_business_id AND warehouse_id=p_source_warehouse_id AND product_id=p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_STOCK_NOT_INITIALIZED'; END IF;
  IF v_source.quantity_on_hand - v_source.quantity_reserved < p_quantity THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;

  SELECT * INTO v_target
  FROM stock_balances
  WHERE tenant_id=p_tenant_id AND business_id=p_business_id AND warehouse_id=p_target_warehouse_id AND product_id=p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
    SELECT gen_random_uuid(),p_tenant_id,p_business_id,w.branch_id,p_target_warehouse_id,p_product_id,0,0
    FROM warehouses w WHERE w.id=p_target_warehouse_id
    RETURNING * INTO v_target;
  END IF;

  UPDATE stock_balances
  SET quantity_on_hand=quantity_on_hand-p_quantity, updated_at=now()
  WHERE id=v_source.id;

  UPDATE stock_balances
  SET quantity_on_hand=quantity_on_hand+p_quantity, updated_at=now()
  WHERE id=v_target.id;

  INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
  SELECT gen_random_uuid(),p_tenant_id,p_business_id,w.branch_id,p_source_warehouse_id,p_product_id,'TRANSFER',p_quantity,0,p_idempotency_key,v_user
  FROM warehouses w WHERE w.id=p_source_warehouse_id;

  INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
  SELECT gen_random_uuid(),p_tenant_id,p_business_id,w.branch_id,p_target_warehouse_id,p_product_id,'TRANSFER',p_quantity,0,p_idempotency_key,v_user
  FROM warehouses w WHERE w.id=p_target_warehouse_id;

  v_response=jsonb_build_object(
    'success',true,
    'operation','TRANSFER',
    'tenantId',p_tenant_id,
    'businessId',p_business_id,
    'sourceWarehouseId',p_source_warehouse_id,
    'targetWarehouseId',p_target_warehouse_id,
    'productId',p_product_id,
    'quantity',p_quantity,
    'idempotencyKey',p_idempotency_key
  );

  INSERT INTO legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response)
  VALUES('ERP_INVENTORY_TRANSFER',v_user,p_idempotency_key,md5(concat_ws('|',p_tenant_id,p_business_id,p_source_warehouse_id,p_target_warehouse_id,p_product_id,p_quantity)),v_response);

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_inventory_backend(uuid,uuid,uuid,uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_inventory_backend(uuid,uuid,uuid,uuid,uuid,numeric,text) TO authenticated;
