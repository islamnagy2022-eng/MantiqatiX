-- RC434 verification queries; read-only. Run against the intended test database before any production rollout.

select
  to_regprocedure('public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)') is not null as function_exists,
  coalesce((
    select p.prosecdef and coalesce(p.proconfig::text,'') like '%search_path=""%'
    from pg_proc p
    where p.oid=to_regprocedure('public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)')
  ),false) as security_definer_empty_search_path,
  coalesce(has_function_privilege('anon','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE'),false) as anon_execute,
  coalesce(has_function_privilege('authenticated','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE'),false) as authenticated_execute,
  coalesce(has_function_privilege('service_role','public.receive_purchase_stock_atomic_backend(character varying,character varying,uuid,character varying,character varying,character varying,uuid,numeric,numeric,uuid)','EXECUTE'),false) as service_role_execute;

select business_id,receipt_number,count(*)::int as duplicate_count
from public.erp_purchase_receipts
group by business_id,receipt_number
having count(*)>1;

select warehouse_id,product_id,count(*)::int as duplicate_count
from public.stock_balances
group by warehouse_id,product_id
having count(*)>1;

-- This schema currently has no purchase-order line table. That remains a release blocker:
-- do not mark receiving fully verified until receipt product/quantity is checked against approved lines.
