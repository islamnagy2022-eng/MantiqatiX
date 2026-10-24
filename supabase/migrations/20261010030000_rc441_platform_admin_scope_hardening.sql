-- RC441: restrict platform-wide MantiGO administration to an explicitly scoped SUPER_ADMIN.
-- Source-only until reviewed and applied through the approved migration pipeline.
-- The previous mnty_can_platform_admin() delegated to mnty_can('admin', NULL, NULL, NULL),
-- which treats tenant OWNER roles as admin for broad/null scope and is not a platform boundary.

create or replace function public.mnty_can_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_memberships m
    where m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and upper(coalesce(m.role, '')) = 'SUPER_ADMIN'
      and upper(coalesce(m.tenant_id, '')) = 'MNTY-PLATFORM'
      and coalesce(m.full_control, false) = true
  );
$$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;

comment on function public.mnty_can_platform_admin() is
  'RC441: platform scope requires an active SUPER_ADMIN membership with PLATFORM scope and full_control; tenant roles are not platform administrators.';
