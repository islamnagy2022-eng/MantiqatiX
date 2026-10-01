-- Public read access for active Egypt administrative center master data.
drop policy if exists platform_geo_areas_public_active_select on public.platform_geo_areas;
create policy platform_geo_areas_public_active_select on public.platform_geo_areas
for select to anon, authenticated
using (status='ACTIVE' and country_code='EG' and level in ('COUNTRY','GOVERNORATE','CENTER'));
grant select on table public.platform_geo_areas to anon, authenticated;
