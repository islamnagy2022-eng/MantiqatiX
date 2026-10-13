CREATE TABLE IF NOT EXISTS public.erp_stock_transfers (
  id character varying PRIMARY KEY,
  tenant_id character varying NOT NULL REFERENCES public.tenants(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  transfer_number character varying NOT NULL,
  from_warehouse_id character varying NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id character varying NOT NULL REFERENCES public.warehouses(id),
  product_id uuid NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  status character varying NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED','APPROVED','IN_TRANSIT','COMPLETED','REJECTED')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, transfer_number)
);

CREATE INDEX IF NOT EXISTS idx_erp_stock_transfers_scope
  ON public.erp_stock_transfers(tenant_id,business_id,created_at DESC);

ALTER TABLE public.erp_stock_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.erp_stock_transfers FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_stock_transfer_backend(
  p_id character varying,
  p_tenant_id character varying,
  p_business_id uuid,
  p_transfer_number character varying,
  p_from_warehouse_id character varying,
  p_to_warehouse_id character varying,
  p_product_id uuid,
  p_quantity numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF p_quantity IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_transfer_number)),0)<1 THEN RAISE EXCEPTION 'INVALID_TRANSFER_ID'; END IF;
 SELECT role INTO v_role FROM user_memberships
 WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouses WHERE id=p_from_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'SOURCE_WAREHOUSE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM warehouses WHERE id=p_to_warehouse_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'TARGET_WAREHOUSE_INVALID'; END IF;
 IF p_from_warehouse_id=p_to_warehouse_id THEN RAISE EXCEPTION 'SAME_WAREHOUSE'; END IF;
 IF NOT EXISTS(SELECT 1 FROM products WHERE id=p_product_id AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE') THEN RAISE EXCEPTION 'PRODUCT_INVALID'; END IF;
 INSERT INTO erp_stock_transfers(id,tenant_id,business_id,transfer_number,from_warehouse_id,to_warehouse_id,product_id,quantity,status,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_transfer_number,p_from_warehouse_id,p_to_warehouse_id,p_product_id,p_quantity,'REQUESTED',v_user)
 ON CONFLICT (id) DO NOTHING;
 SELECT to_jsonb(t) INTO v_row FROM erp_stock_transfers t WHERE t.id=p_id;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.update_stock_transfer_status_backend(
  p_transfer_id character varying,
  p_target_status character varying
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_current text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT t.status INTO v_current FROM erp_stock_transfers t WHERE t.id=p_transfer_id FOR UPDATE;
 IF v_current IS NULL THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
 SELECT role INTO v_role FROM user_memberships m JOIN erp_stock_transfers t ON t.tenant_id=m.tenant_id AND t.business_id=m.business_id
 WHERE m.user_id=v_user AND m.status='ACTIVE' AND t.id=p_transfer_id LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF p_target_status='APPROVED' AND v_current<>'REQUESTED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 IF p_target_status='IN_TRANSIT' AND v_current<>'APPROVED' THEN RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 UPDATE erp_stock_transfers SET status=p_target_status,updated_at=now() WHERE id=p_transfer_id;
 SELECT to_jsonb(t) INTO v_row FROM erp_stock_transfers t WHERE t.id=p_transfer_id;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $$;

CREATE OR REPLACE FUNCTION public.receive_stock_transfer_backend(
  p_transfer_id character varying
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; t erp_stock_transfers%ROWTYPE; s stock_balances%ROWTYPE; d stock_balances%ROWTYPE; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO t FROM erp_stock_transfers WHERE id=p_transfer_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSFER_NOT_FOUND'; END IF;
 SELECT role INTO v_role FROM user_memberships WHERE user_id=v_user AND tenant_id=t.tenant_id AND business_id=t.business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'ERP_INVENTORY_ROLE_REQUIRED'; END IF;
 IF t.status='COMPLETED' THEN SELECT to_jsonb(t) INTO v_row; RETURN jsonb_build_object('success',true,'transfer',v_row,'idempotent',true); END IF;
 IF t.status<>'IN_TRANSIT' THEN RAISE EXCEPTION 'TRANSFER_NOT_IN_TRANSIT'; END IF;
 SELECT * INTO s FROM stock_balances WHERE tenant_id=t.tenant_id AND business_id=t.business_id AND warehouse_id=t.from_warehouse_id AND product_id=t.product_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_STOCK_NOT_INITIALIZED'; END IF;
 IF s.quantity_on_hand-s.quantity_reserved<t.quantity THEN RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_STOCK'; END IF;
 SELECT * INTO d FROM stock_balances WHERE tenant_id=t.tenant_id AND business_id=t.business_id AND warehouse_id=t.to_warehouse_id AND product_id=t.product_id FOR UPDATE;
 IF NOT FOUND THEN
   INSERT INTO stock_balances(id,tenant_id,business_id,branch_id,warehouse_id,product_id,quantity_on_hand,quantity_reserved)
   SELECT 'sb-'||gen_random_uuid()::text,t.tenant_id,t.business_id,w.branch_id,t.to_warehouse_id,t.product_id,0,0 FROM warehouses w WHERE w.id=t.to_warehouse_id
   RETURNING * INTO d;
 END IF;
 UPDATE stock_balances SET quantity_on_hand=quantity_on_hand-t.quantity,updated_at=now() WHERE id=s.id;
 UPDATE stock_balances SET quantity_on_hand=quantity_on_hand+t.quantity,updated_at=now() WHERE id=d.id;
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 SELECT 'it-'||gen_random_uuid()::text,t.tenant_id,t.business_id,w.branch_id,t.from_warehouse_id,t.product_id,'TRANSFER_OUT',-t.quantity,0,t.id,v_user FROM warehouses w WHERE w.id=t.from_warehouse_id;
 INSERT INTO inventory_transactions(id,tenant_id,business_id,branch_id,warehouse_id,product_id,transaction_type,quantity,unit_cost,reference_id,created_by)
 SELECT 'it-'||gen_random_uuid()::text,t.tenant_id,t.business_id,w.branch_id,t.to_warehouse_id,t.product_id,'TRANSFER_IN',t.quantity,0,t.id,v_user FROM warehouses w WHERE w.id=t.to_warehouse_id;
 UPDATE erp_stock_transfers SET status='COMPLETED',updated_at=now() WHERE id=t.id RETURNING * INTO t;
 SELECT to_jsonb(t) INTO v_row;
 RETURN jsonb_build_object('success',true,'transfer',v_row);
END; $$;

REVOKE ALL ON FUNCTION public.create_stock_transfer_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_stock_transfer_status_backend(character varying,character varying) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.receive_stock_transfer_backend(character varying) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stock_transfer_status_backend(character varying,character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer_backend(character varying) TO authenticated;
