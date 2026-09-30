-- Production security hardening applied to Supabase project moyhiluyhjsujhwlyeuu.
-- Intent: make four RLS-protected internal tables explicitly deny direct client access,
-- and remove anonymous EXECUTE from internal provider-geo RPCs.
create policy "deny_direct_access_authenticated" on public.advertisement_target_locations
  as restrictive for all to authenticated using (false) with check (false);
create policy "deny_direct_access_anon" on public.advertisement_target_locations
  as restrictive for all to anon using (false) with check (false);

create policy "deny_direct_access_authenticated" on public.platform_geo_areas
  as restrictive for all to authenticated using (false) with check (false);
create policy "deny_direct_access_anon" on public.platform_geo_areas
  as restrictive for all to anon using (false) with check (false);

create policy "deny_direct_access_authenticated" on public.platform_global_advertisements
  as restrictive for all to authenticated using (false) with check (false);
create policy "deny_direct_access_anon" on public.platform_global_advertisements
  as restrictive for all to anon using (false) with check (false);

create policy "deny_direct_access_authenticated" on public.smm_providers
  as restrictive for all to authenticated using (false) with check (false);
create policy "deny_direct_access_anon" on public.smm_providers
  as restrictive for all to anon using (false) with check (false);

revoke execute on function public.find_mnty_nearby_provider_businesses(double precision,double precision,double precision) from anon;
revoke execute on function public.find_mnty_nearest_provider_businesses(double precision,double precision,integer) from anon;
