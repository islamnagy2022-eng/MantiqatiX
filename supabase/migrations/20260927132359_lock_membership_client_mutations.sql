drop policy if exists "authenticated_sessions_only" on public.user_memberships;
drop policy if exists "deny_anonymous_users" on public.user_memberships;
drop policy if exists "mnt_non_anonymous_boundary" on public.user_memberships;
drop policy if exists "non_anonymous_authenticated_guard" on public.user_memberships;

drop policy if exists "memberships_select_self" on public.user_memberships;
create policy "memberships_select_self" on public.user_memberships
for select to authenticated
using (
  coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true'
  and auth.uid() = user_id
);

comment on policy "memberships_select_self" on public.user_memberships is
'Client can read only its own active/owned membership rows. Membership creation, role changes, permissions, status changes and deletion are server-authoritative.';