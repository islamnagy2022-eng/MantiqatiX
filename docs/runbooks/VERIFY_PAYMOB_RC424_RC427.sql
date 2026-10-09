-- Read-only post-migration verification for RC424–RC427.
-- Run only after a separately approved rollout, against the intended Supabase project.
-- Each SELECT is independent. This file performs no DDL or DML.

-- Read-only post-migration verification for RC424–RC428.
-- 1) Expected objects and function signatures.
select
  to_regclass('public.digital_page_payment_events') as digital_page_payment_events,
  to_regclass('public.mantigo_payment_provider_events') as mantigo_payment_provider_events,
  to_regprocedure('public.process_verified_digital_page_payment_backend(uuid,text,text,text,boolean,numeric,text,text,text,jsonb)') as digital_page_payment_rpc,
  to_regprocedure('public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)') as mantigo_payment_rpc,
  to_regprocedure('public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)') as normal_payment_failure_rpc,
  to_regprocedure('public.finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)') as digital_page_finalizer_v2;

-- 2) Backend-only event-table RLS state.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('digital_page_payment_events', 'mantigo_payment_provider_events')
order by c.relname;

-- 3) Critical function privilege boundary. Expected: service_role can execute the atomic
-- payment RPCs; anon/authenticated cannot execute the service-role-only processors.
select p.oid::regprocedure as function_signature,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute,
       p.prosecdef as security_definer, p.proconfig as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'process_verified_digital_page_payment_backend',
    'process_verified_mantigo_payment_backend',
    'process_verified_provider_payment_failure',
    'finalize_digital_page_payment_intent_backend'
  )
order by p.proname, p.oid::regprocedure::text;

-- 4) RC427 index presence and validity.
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname = 'uq_payment_intents_one_active_per_order';

select i.indexrelid::regclass as index_name, i.indisvalid, i.indisready, i.indislive
from pg_index i
where i.indexrelid = to_regclass('public.uq_payment_intents_one_active_per_order');

-- 5) Active payment-intent duplicates. Expected: zero rows.
select order_id, count(*) as active_intents
from public.payment_intents
where upper(status) in ('CREATED', 'PENDING', 'SUCCEEDED')
group by order_id
having count(*) > 1;

-- 6) Pending/active checkouts that lack provider-order correlation require manual compatibility
-- review; do not repair these rows with ad-hoc UPDATE statements.
select 'payment_intents' as source, id::text as record_id, status, provider_order_id
from public.payment_intents
where upper(status) in ('CREATED', 'PENDING')
  and provider_order_id is null
union all
select 'subscription_payment_intents', id::text, status, provider_order_id
from public.subscription_payment_intents
where upper(status) in ('CREATED', 'PENDING')
  and provider_order_id is null
union all
select 'digital_page_orders', id::text, payment_status, provider_order_id
from public.digital_page_orders
where upper(payment_status) = 'PENDING'
  and provider_order_id is null
union all
select 'mantigo_financial_ledger', id, payment_status, null::text
from public.mantigo_financial_ledger
where upper(payment_status) = 'PENDING'
  and nullif(metadata->>'paymob_intention_order_id', '') is null;
