BEGIN;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_stock_backend(
  varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_stock_backend(
  varchar,varchar,uuid,varchar,varchar,varchar,uuid,numeric,numeric
) TO authenticated;
COMMIT;
