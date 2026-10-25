-- RC572: restrict the platform-admin convenience helper to explicit platform super-admin scope.
-- Forward-only correction: tenant/business OWNER and ADMIN roles are not platform administrators.
create or replace function public.mnty_can_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.mnty_active_membership(null, null, null) m
    where upper(m.role) = 'SUPER_ADMIN'
      and coalesce((m.permissions ->> 'scope') = 'PLATFORM', false)
      and coalesce((m.permissions ->> 'full_control')::boolean, false)
  );
$$;

comment on function public.mnty_can_platform_admin() is
  'Platform admin guard: requires an active SUPER_ADMIN membership with explicit PLATFORM scope and full_control=true.';
