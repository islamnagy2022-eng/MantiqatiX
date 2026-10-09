-- RC435 post-migration verification queries; read-only.
select
  to_regprocedure('public.claim_subscription_provider_intent_creation_backend(uuid,uuid)') is not null as function_exists,
  coalesce((select p.prosecdef and coalesce(p.proconfig::text,'') like '%search_path=""%'
    from pg_proc p where p.oid=to_regprocedure('public.claim_subscription_provider_intent_creation_backend(uuid,uuid)')),false) as security_definer_empty_search_path,
  coalesce(has_function_privilege('anon','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE'),false) as anon_execute,
  coalesce(has_function_privilege('authenticated','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE'),false) as authenticated_execute,
  coalesce(has_function_privilege('service_role','public.claim_subscription_provider_intent_creation_backend(uuid,uuid)','EXECUTE'),false) as service_role_execute;

select status,
       count(*)::int as total,
       count(*) filter (where provider_intent_id is null or provider_order_id is null)::int as missing_provider_correlation,
       min(created_at) as oldest_created_at
from public.subscription_payment_intents
group by status
order by status;

-- Any PENDING intent without both provider IDs requires reconciliation, not another Paymob create call.
select id,business_id,status,provider_intent_id,provider_order_id,created_at,updated_at
from public.subscription_payment_intents
where status='PENDING' and (provider_intent_id is null or provider_order_id is null)
order by created_at;
