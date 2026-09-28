-- RC111: explicitly exclude anonymous Auth users from the audit-log admin read boundary.
drop policy if exists audit_logs_select_admin_scope on public.audit_logs;

create policy audit_logs_select_admin_scope
on public.audit_logs
for select
to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and exists (
    select 1
    from public.user_memberships um
    where um.user_id = (select auth.uid())
      and um.tenant_id::text = audit_logs.tenant_id::text
      and um.status = 'ACTIVE'
      and upper(um.role) = any(array['OWNER','BUSINESS_OWNER','ADMIN','MANAGER'])
  )
);
