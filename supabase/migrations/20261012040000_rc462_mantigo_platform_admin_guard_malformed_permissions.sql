-- RC462: make the MantiGO platform-admin permission check fail closed for malformed JSON values.
-- Forward-only correction: RC449 is historical candidate migration and must remain immutable.
create or replace function public.mnty_can_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
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
  )
$function$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;
