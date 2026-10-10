-- RC432 post-migration verification; read-only.
-- Run only against the intended test database before considering production rollout.

select
  to_regclass('public.smm_wallet_transactions_reference_type_uidx') is not null as index_exists,
  coalesce((select i.indisvalid and i.indisready
    from pg_index i join pg_class c on c.oid=i.indexrelid
    where c.oid=to_regclass('public.smm_wallet_transactions_reference_type_uidx')),false) as index_valid;

select reference_id,type,count(*)::int as duplicate_count
from public.smm_wallet_transactions
where reference_id is not null and type in ('DEBIT','REFUND','CREDIT')
group by reference_id,type
having count(*)>1;

select p.proname,
       pg_get_function_result(p.oid) as result_type,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('smm_debit_wallet','smm_refund_wallet')
order by p.proname;
