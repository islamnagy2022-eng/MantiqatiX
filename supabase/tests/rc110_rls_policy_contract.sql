-- RC110: structural regression contract for the production audit-log access boundary.
-- Behavioral RLS tests require a dedicated test harness; production does not install pgTAP.

select 1 as audit_policy_exists
where exists (
  select 1
  from pg_policy p
  join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname='audit_logs'
    and p.polname='audit_logs_select_admin_scope'
);
