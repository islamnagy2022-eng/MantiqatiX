-- RC572: preserve the platform-admin tenant and malformed-JSON protections from RC462.
-- Forward-only candidate fix: tenant-local SUPER_ADMIN roles are not platform admins.
-- Keep this helper VOLATILE and request-context aware; do not regress RC462's guard.
create or replace function public.mnty_can_platform_admin()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.user_memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = 'MNTY-PLATFORM'
      and m.status = 'ACTIVE'
      and upper(m.role) = 'SUPER_ADMIN'
      and coalesce(
        m.permissions @> '{"scope":"PLATFORM","full_control":true}'::jsonb,
        false
      )
  );
end
$$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;

comment on function public.mnty_can_platform_admin() is
  'Platform admin guard: requires an active SUPER_ADMIN membership in MNTY-PLATFORM with exact JSON Booleans scope=PLATFORM and full_control=true.';
