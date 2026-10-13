CREATE OR REPLACE FUNCTION public.update_purchase_order_status_backend(p_order_id varchar,p_target_status varchar)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); r text; x erp_purchase_orders%ROWTYPE; rowj jsonb; next_status text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 SELECT * INTO x FROM erp_purchase_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'PURCHASE_ORDER_NOT_FOUND'; END IF;
 SELECT role INTO r FROM user_memberships WHERE user_id=u AND tenant_id=x.tenant_id AND business_id=x.business_id AND status='ACTIVE' LIMIT 1;
 IF r IS NULL THEN RAISE EXCEPTION 'PURCHASE_ORDER_ROLE_REQUIRED'; END IF;
 IF p_target_status='SUBMITTED' AND x.status='DRAFT' THEN
   next_status:=CASE WHEN x.total_amount>5000 THEN 'PENDING_APPROVAL' ELSE 'SUBMITTED' END;
 ELSIF p_target_status='APPROVED' AND x.status='PENDING_APPROVAL' AND upper(r) IN ('OWNER','BUSINESS_OWNER','ADMIN') THEN
   next_status:='APPROVED';
 ELSE RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'; END IF;
 UPDATE erp_purchase_orders SET status=next_status,updated_at=now() WHERE id=x.id RETURNING * INTO x;
 SELECT to_jsonb(x) INTO rowj;
 RETURN jsonb_build_object('success',true,'order',rowj);
END; $$;
