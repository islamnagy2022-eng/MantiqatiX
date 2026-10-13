ALTER TABLE public.erp_purchase_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.erp_purchase_orders FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_purchase_order_backend(
 p_id varchar,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_order_number varchar,p_supplier_id varchar,
 p_total_amount numeric,p_tax_amount numeric,p_discount_amount numeric,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r text; rowj jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_order_number)),0)<1 OR p_total_amount<0 OR p_tax_amount<0 OR p_discount_amount<0 THEN RAISE EXCEPTION 'INVALID_PURCHASE_ORDER'; END IF;
 SELECT role INTO r FROM user_memberships WHERE user_id=u AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF r IS NULL OR upper(r) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'PURCHASE_ORDER_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM businesses WHERE id=p_business_id AND tenant_id=p_tenant_id AND status='ACTIVE') THEN RAISE EXCEPTION 'BUSINESS_INVALID'; END IF;
 IF p_branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branches WHERE id=p_branch_id AND business_id=p_business_id) THEN RAISE EXCEPTION 'BRANCH_INVALID'; END IF;
 INSERT INTO erp_purchase_orders(id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_branch_id,p_order_number,p_supplier_id,p_total_amount,p_tax_amount,p_discount_amount,'DRAFT',p_reason,u)
 ON CONFLICT(id) DO NOTHING;
 SELECT to_jsonb(x) INTO rowj FROM erp_purchase_orders x WHERE x.id=p_id;
 RETURN jsonb_build_object('success',true,'order',rowj);
END; $$;

CREATE OR REPLACE FUNCTION public.update_purchase_order_status_backend(p_order_id varchar,p_target_status varchar)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r text; x erp_purchase_orders%ROWTYPE; rowj jsonb;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO x FROM erp_purchase_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_ORDER_NOT_FOUND'; END IF;
 SELECT role INTO r FROM user_memberships WHERE user_id=u AND tenant_id=x.tenant_id AND business_id=x.business_id AND status='ACTIVE' LIMIT 1;
 IF r IS NULL THEN RAISE EXCEPTION 'PURCHASE_ORDER_ROLE_REQUIRED'; END IF;
 IF p_target_status='SUBMITTED' AND x.status='DRAFT' THEN NULL;
 ELSIF p_target_status='APPROVED' AND x.status='PENDING_APPROVAL' AND upper(r) IN ('OWNER','BUSINESS_OWNER','ADMIN') THEN NULL;
 ELSE RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 UPDATE erp_purchase_orders SET status=p_target_status,updated_at=now() WHERE id=x.id RETURNING * INTO x;
 SELECT to_jsonb(x) INTO rowj;
 RETURN jsonb_build_object('success',true,'order',rowj);
END; $$;

REVOKE ALL ON FUNCTION public.create_purchase_order_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,numeric,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_purchase_order_status_backend(varchar,varchar) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_order_backend(varchar,varchar,uuid,varchar,varchar,varchar,numeric,numeric,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_purchase_order_status_backend(varchar,varchar) TO authenticated;
