CREATE TABLE IF NOT EXISTS public.erp_purchase_receipts (
id character varying PRIMARY KEY,
tenant_id character varying NOT NULL REFERENCES public.tenants(id),
business_id uuid NOT NULL REFERENCES public.businesses(id),
purchase_order_id character varying NOT NULL,
receipt_number character varying NOT NULL,
warehouse_id character varying NOT NULL REFERENCES public.warehouses(id),
product_id uuid NOT NULL,
received_quantity numeric NOT NULL CHECK (received_quantity > 0),
unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
status character varying NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','VOID')),
created_by uuid NOT NULL REFERENCES auth.users(id),
created_at timestamptz NOT NULL DEFAULT now(),
UNIQUE (business_id, receipt_number)
);
CREATE INDEX IF NOT EXISTS idx_erp_purchase_receipts_scope ON public.erp_purchase_receipts(tenant_id,business_id,created_at DESC);
ALTER TABLE public.erp_purchase_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.erp_purchase_receipts FROM PUBLIC,anon,authenticated;
