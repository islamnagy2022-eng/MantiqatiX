-- RC338: read-only production boundary audit.
with required as (
  select * from (values
    ('orders'),('payment_intents'),('user_memberships'),('support_tickets'),
    ('ticket_messages'),('notifications'),('financial_obligations'),
    ('settlement_transactions'),('general_ledger')
  ) v(table_name)
), actual as (
  select c.relname table_name,c.relrowsecurity rls_enabled,
         count(p.oid)::int policy_count
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  left join pg_policy p on p.polrelid=c.oid
  where n.nspname='public'
  group by c.relname,c.relrowsecurity
)
select r.table_name,
       coalesce(a.rls_enabled,false) rls_enabled,
       coalesce(a.policy_count,0) policy_count,
       case
         when coalesce(a.rls_enabled,false)=true and coalesce(a.policy_count,0)>0 then 'PASS'
         else 'FAIL'
       end status
from required r left join actual a using(table_name)
order by r.table_name;

select conname, pg_get_constraintdef(oid) definition
from pg_constraint c
join pg_class t on t.oid=c.conrelid
join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public'
  and t.relname='payment_intents'
  and conname='uk_tenant_idempotency';

select p.oid::regprocedure::text signature,
       p.prosecdef,
       has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
       coalesce(array_to_string(p.proconfig,','),'') config
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.prosecdef=true
  and p.proname in (
    'admin_create_global_ad','create_job_backend',
    'create_medical_appointment_backend','create_payment_intent_backend',
    'get_mnty_targeted_advertisements','mnty_active_membership',
    'mnty_can','mnty_can_platform_admin','update_medical_appointment_status_backend'
  )
order by 1;
