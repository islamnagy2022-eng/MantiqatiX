-- RC337: read-only verification contract for exposed SECURITY DEFINER functions.
-- No DDL/DML. Execute in a privileged verification session.
with expected as (
  select * from (values
    ('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)', false, true),
    ('public.create_job_backend(uuid,text,character varying,uuid,text,text,text,text,text,text,text,text)', false, true),
    ('public.create_medical_appointment_backend(uuid,text,uuid,text,bigint,text)', false, true),
    ('public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)', false, true),
    ('public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)', true, true),
    ('public.mnty_active_membership(character varying,uuid,character varying)', false, true),
    ('public.mnty_can(text,character varying,uuid,character varying)', false, true),
    ('public.mnty_can_platform_admin()', false, true),
    ('public.update_medical_appointment_status_backend(uuid,text,text)', false, true)
  ) v(signature, expected_anon, expected_authenticated)
), actual as (
  select p.oid::regprocedure::text signature,
         has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
         has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
         p.prosecdef security_definer,
         coalesce(array_to_string(p.proconfig,','),'') config
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef=true
)
select e.signature,
       e.expected_anon,
       a.anon_execute,
       e.expected_authenticated,
       a.authenticated_execute,
       a.security_definer,
       a.config,
       case
         when a.security_definer
          and a.anon_execute=e.expected_anon
          and a.authenticated_execute=e.expected_authenticated
          and (
            (e.signature = 'public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)'
              and a.config in ('search_path=""','search_path='))
            or (e.signature <> 'public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)'
              and a.config in ('search_path=public, pg_temp','search_path=public,pg_temp'))
          )
         then 'PASS'
         else 'FAIL'
       end status
from expected e
left join actual a on a.signature=e.signature
order by e.signature;

-- The following must remain true:
-- 1) No listed sensitive RPC is callable by anon except the intentionally public targeted-ad boundary.
-- 2) All listed RPCs retain SECURITY DEFINER only where their server-side authorization contract requires it.
-- 3) Every exposed SECURITY DEFINER RPC has an explicit search_path hardening setting.
