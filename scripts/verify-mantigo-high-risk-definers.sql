-- Read-only release regression contract for high-risk SECURITY DEFINER boundaries.
-- This script intentionally performs no writes and is safe to run in production.
with expected(signature, expect_anon, expect_auth, expected_search_path) as (
 values
 ('public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)',false,true,'search_path=public, pg_temp'),
 ('public.mnty_active_membership(character varying,uuid,character varying)',false,true,'search_path=public, pg_temp'),
 ('public.mnty_can(text,character varying,uuid,character varying)',false,true,'search_path=public, pg_temp'),
 ('public.mnty_can_platform_admin()',false,true,'search_path=""'),
 ('public.preview_commission_backend(character varying,uuid,character varying,numeric)',false,true,'search_path=public'),
 ('public.get_mantigo_admin_dashboard_backend(uuid)',false,true,'search_path=""'),
 ('public.get_mantigo_admin_financial_report_backend(uuid,timestamp with time zone,timestamp with time zone)',false,true,'search_path=""'),
 ('public.get_mantigo_captain_earnings_backend(uuid)',false,true,'search_path=public'),
 ('public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb)',false,true,'search_path=""'),
 ('public.settle_mantigo_captain_backend(uuid,text,text)',false,true,'search_path=""'),
 ('public.expire_stale_mantigo_rides_backend(uuid,integer)',false,true,'search_path=""'),
 ('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)',false,true,'search_path=""'),
 ('public.fulfill_digital_page_publish(uuid,uuid,uuid)',false,true,'search_path=""'),
 ('public.set_mantigo_financial_config_backend(uuid,numeric,text)',false,true,'search_path=""') ), actual as (
 select 'public.'||p.proname||'('||replace(pg_catalog.oidvectortypes(p.proargtypes), ', ', ',')||')' signature,
        has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
        has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec,
        p.prosecdef,
        p.proconfig
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.prosecdef
 )
select e.signature,e.expect_anon,e.expect_auth,e.expected_search_path,
       a.anon_exec,a.auth_exec,a.prosecdef,a.proconfig,
       case when a.signature is null then 'MISSING'
            when a.anon_exec<>e.expect_anon or a.auth_exec<>e.expect_auth or not a.prosecdef then 'FAIL_ACL'
            when NOT coalesce(a.proconfig @> ARRAY[e.expected_search_path]::text[],false) then 'FAIL_SEARCH_PATH'
            else 'PASS' end result
from expected e left join actual a using(signature)
order by e.signature;

select count(*) filter (where has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE')) anon_write_grants,
       count(*) filter (where has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')) authenticated_write_grants
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname in ('mantigo_rides','mantigo_bids','mantigo_captain_profiles','mantigo_financial_ledger','mantigo_financial_config');
