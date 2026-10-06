-- Read-only release regression contract for high-risk SECURITY DEFINER boundaries.
-- This script intentionally performs no writes and is safe to run in production.
with expected(signature, expect_anon, expect_auth) as (
 values
 ('public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)',false,true),
 ('public.mnty_active_membership(character varying,uuid,character varying)',false,true),
 ('public.mnty_can(text,character varying,uuid,character varying)',false,true),
 ('public.mnty_can_platform_admin()',false,true),
 ('public.preview_commission_backend(character varying,uuid,character varying,numeric)',false,true),
 ('public.get_mantigo_admin_dashboard_backend(uuid)',false,true),
 ('public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)',false,true),
 ('public.get_mantigo_captain_earnings_backend(uuid)',false,true),
 ('public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)',false,true),
 ('public.settle_mantigo_captain_backend(uuid,text,text)',false,true),
 ('public.expire_stale_mantigo_rides_backend(uuid,integer)',false,true)
 ), actual as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,
        has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
        has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,
        p.prosecdef,
        p.proconfig
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
 )
select e.signature,e.expect_anon,e.expect_auth,
       a.anon_exec,a.auth_exec,a.prosecdef,a.proconfig,
       case when a.signature is null then 'MISSING'
            when a.anon_exec<>e.expect_anon or a.auth_exec<>e.expect_auth or not a.prosecdef then 'FAIL'
            when not exists(select 1 from unnest(coalesce(a.proconfig,'{}'::text[])) x where x like 'search_path=%public%') then 'FAIL_SEARCH_PATH'
            else 'PASS' end result
from expected e left join actual a using(signature)
order by e.signature;

select count(*) filter (where has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE')) anon_write_grants,
       count(*) filter (where has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')) authenticated_write_grants
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in ('mantigo_rides','mantigo_bids','mantigo_captain_profiles','mantigo_financial_ledger','mantigo_financial_config');
