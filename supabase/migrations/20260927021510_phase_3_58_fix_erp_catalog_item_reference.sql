CREATE OR REPLACE FUNCTION public.create_stock_transfer_backend(p_id character varying, p_tenant_id character varying, p_business_id uuid, p_transfer_number character varying, p_from_warehouse_id character varying, p_to_warehouse_id character varying, p_product_id uuid, p_quantity numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_user uuid:=auth.uid(); v_role text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_transfer_number)),0)<1 THEN RAISE EXCEPTION 'INVALID_TRANSFER_ID'; END IF;
 SELECT role INTO v_role FROM user_memberships WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouses WHERE id=p_from_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'SOURCE_WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouses WHERE id=p_to_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'TARGET_WAREHOUSE_INVALID'; END IF;
 IF p_from_warehouse_id=p_to_warehouse_id THEN RAISE EXCEPTION 'SAME_WAREHOUSE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM catalog_items WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 INSERT INTO erp_stock_transfers(id,tenant_id,business_id,transfer_number,from_warehouse_id,to_warehouse_id,product_id,quantity,status,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_transfer_number,p_from_warehouse_id,p_to_warehouse_id,p_product_id,p_quantity,'REQUESTED',v_user)
 ON CONFLICT (id) DO NOTHING;
 SELECT to_jsonb(t) INTO v_row FROM erp_stock_transfers t WHERE t.id=p_id;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $function$;

REVOKE EXECUTE ON FUNCTION public.create_stock_transfer_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric) TO authenticated;
