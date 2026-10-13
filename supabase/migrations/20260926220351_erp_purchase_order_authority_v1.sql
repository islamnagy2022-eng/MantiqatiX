CREATE TABLE IF NOT EXISTS public.erp_purchase_orders (
  id character varying PRIMARY KEY,
  tenant_id character varying NOT NULL REFERENCES public.tenants(id),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  branch_id character varying REFERENCES public.branches(id),
  order_number character varying NOT NULL,
  supplier_id character varying NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  tax_amount numeric NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount numeric NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  status character varying NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SUBMITTED','PENDING_APPROVAL','APPROVED','POSTED','VOID')),
  reason text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, order_number)
);
CREATE INDEX IF NOT EXISTS idx_erp_purchase_orders_scope
 ON public.erp_purchase_orders(tenant_id,business_id,created_at DESC);
ALTER TABLE public.erp_purchase_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.erp_purchase_orders FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_purchase_order_backend(
 p_id character varying,p_tenant_id character varying,p_business_id uuid,p_branch_id character varying,
 p_order_number character varying,p_supplier_id character varying,p_total_amount numeric,p_tax_amount numeric,p_discount_amount numeric,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); v_role text; v_row jsonb;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
 IF coalesce(length(trim(p_id)),0)<8 OR coalesce(length(trim(p_order_number)),0)<1 OR coalesce(p_total_amount,0)<0 OR coalesce(p_tax_amount,0)<0 OR coalesce(p_discount_amount,0)<0 THEN RAISE EXCEPTION 'INVALID_PURCHASE_ORDER'; END IF;
 SELECT role INTO v_role FROM user_memberships WHERE user_id=v_user AND tenant_id=p_tenant_id AND business_id=p_business_id AND status='ACTIVE' LIMIT 1;
 IF v_role IS NULL OR upper(v_role) NOT IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','EMPLOYEE','STAFF') THEN RAISE EXCEPTION 'PURCHASE_ORDER_ROLE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM businesses WHERE id=p_business_id AND tenant_id=p_tenant_id AND status='ACTIVE') THEN RAISE EXCEPTION 'BUSINESS_INVALID'; END IF;
 IF p_branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branches WHERE id=p_branch_id AND tenant_id=p_tenant_id AND business_id=p_business_id) THEN RAISE EXCEPTION 'BRANCH_INVALID'; END IF;
 INSERT INTO erp_purchase_orders(id,tenant_id,business_id,branch_id,order_number,supplier_id,total_amount,tax_amount,discount_amount,status,reason,created_by)
 VALUES(p_id,p_tenant_id,p_business_id,p_branch_id,p_order_number,p_supplier_id,p_total_amount,p_tax_amount,p_discount_amount,'DRAFT',p_reason,v_user)
 ON CONFLICT(id) DO NOTHING;
 SELECT to_jsonb(o) INTO v_row FROM erp_purchase_orders o WHERE o.id=p_id;
 RETURN jsonb_build_object('success',true,'purchase_order',v_row);
END; $$;

REVOKE ALL ON FUNCTION public.create_purchase_order_backend(character varying,character varying,uuid,character varying,character varying,character varying,numeric,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_purchase_order_backend(character varying,character varying,uuid,character varying,character varying,character varying,numeric,numeric,numeric,text) TO authenticated;
