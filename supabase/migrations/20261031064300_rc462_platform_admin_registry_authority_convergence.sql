-- RC462: converge platform-root authorization on the canonical private registry.
-- RC113/RC115 define private.platform_admins as the authoritative platform-owner registry.
-- RC441/RC449 previously checked only MNTY-PLATFORM membership, creating two distinct
-- sources of truth. This forward-only migration makes the shared guard use the registry.

do $preflight$
declare
  v_guarded_rpc_count integer;
begin
  if pg_catalog.to_regclass('private.platform_admins') is null then
    raise exception 'RC462_PLATFORM_ADMIN_REGISTRY_MISSING';
  end if;

  -- Do not silently harden only the helper while the four global MantiGO RPCs
  -- still contain their old inline membership checks. RC449 must be applied first.
  select count(*) into v_guarded_rpc_count
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'get_mantigo_admin_dashboard_backend',
      'get_mantigo_admin_financial_report_backend',
      'settle_mantigo_captain_backend',
      'expire_stale_mantigo_rides_backend'
    )
    and p.prosecdef
    and p.prosrc ilike '%mnty_can_platform_admin%';

  if v_guarded_rpc_count <> 4 then
    raise exception 'RC462_REQUIRES_RC449_GLOBAL_RPC_GUARDS: expected four SECURITY DEFINER RPCs calling mnty_can_platform_admin(), found %',v_guarded_rpc_count;
  end if;
end;
$preflight$;

create or replace function public.mnty_can_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from private.platform_admins pa
    where pa.user_id = auth.uid()
  )
$function$;

revoke all on function public.mnty_can_platform_admin() from public, anon;
grant execute on function public.mnty_can_platform_admin() to authenticated;

comment on function public.mnty_can_platform_admin() is
  'RC462: canonical platform-root guard backed only by private.platform_admins, aligned with RC113/RC115; platform membership alone is not root authority.';
