-- RC220: source reconciliation for SUPER_ADMIN branch authority.
drop policy if exists branches_super_admin_write on public.branches;
create policy branches_super_admin_write on public.branches
for all to authenticated
using (exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=branches.tenant_id and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))
with check (exists(select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=branches.tenant_id and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true));