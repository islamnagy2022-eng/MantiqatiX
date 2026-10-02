-- RC257 read-only SECURITY DEFINER privilege contract.
-- Execute in a privileged verification session; contains no DDL/DML.
with expected as (
  select * from (values
    ('admin_create_global_ad',false,true),
    ('create_job_backend',false,true),
    ('create_medical_appointment_backend',false,true),
    ('create_payment_intent_backend',false,true),
    ('get_mnty_targeted_advertisements',true,true),
    ('update_medical_appointment_status_backend',false,true)
  ) v(proname,anon_exec,auth_exec)
), actual as (
  select p.proname,
         has_function_privilege('anon',p.oid,'EXECUTE') anon_exec,
         has_function_privilege('authenticated',p.oid,'EXECUTE') auth_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef=true
)
select e.proname,e.anon_exec as expected_anon,a.anon_exec as actual_anon,
       e.auth_exec as expected_authenticated,a.auth_exec as actual_authenticated,
       case when e.anon_exec=a.anon_exec and e.auth_exec=a.auth_exec then 'PASS' else 'FAIL' end status
from expected e join actual a using(proname)
order by e.proname;