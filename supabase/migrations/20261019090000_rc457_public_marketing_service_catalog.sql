-- RC457: expose an explicit, read-only public service catalog.
-- The view publishes only allowlisted columns and ACTIVE rows. Direct anonymous
-- reads of the base table remain denied; authenticated management retains its
-- existing table policies and permissions.
alter table public.marketing_services enable row level security;

drop policy if exists marketing_services_public_active_read
  on public.marketing_services;

revoke all on table public.marketing_services from public, anon;

create or replace view public.marketing_services_public
with (security_barrier = true)
as
select id, code, name_ar, name_en, category_code, description, status, created_at
from public.marketing_services
where status = 'ACTIVE';

revoke all on table public.marketing_services_public from public, anon, authenticated;
grant select on table public.marketing_services_public to anon, authenticated;
