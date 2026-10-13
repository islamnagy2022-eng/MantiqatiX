-- RC462: make the MantiGO platform-admin permission check fail closed for malformed JSON values.
-- Forward-only correction: RC449 is historical candidate migration and must remain immutable.
-- VOLATILE is intentional: the guard reads request-scoped auth context, which must be
-- re-evaluated when the session JWT subject changes; this also makes multi-identity tests faithful.
create or replace function public.mnty_can_platform_admin()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  -- Keep request identity lookup inside a non-inlined PL/pgSQL body. The guard is
  -- called from SECURITY DEFINER RPCs and must re-evaluate the caller's JWT context.
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
$function$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;
