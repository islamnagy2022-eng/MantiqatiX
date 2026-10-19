-- RC457: expose only active public service-catalog rows to anonymous visitors.
-- Keep the public directory read-only and column-limited; private/provider operations
-- remain behind their existing policies and backend authorization.

alter table public.marketing_services enable row level security;

drop policy if exists marketing_services_public_active_read
  on public.marketing_services;

create policy marketing_services_public_active_read
on public.marketing_services
for select
to anon, authenticated
using (status = 'ACTIVE');

-- Remove any table-wide anonymous SELECT grant before granting the public catalog
-- allowlist. This prevents newly added/internal columns becoming public by accident.
revoke select on table public.marketing_services from public, anon;
grant select (
  id, code, name_ar, name_en, category_code, description, status, created_at
) on table public.marketing_services to anon;

