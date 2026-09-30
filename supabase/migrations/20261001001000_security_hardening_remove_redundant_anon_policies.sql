-- RLS with no anon policy already denies anonymous direct table access.
-- Keep the explicit authenticated deny policy, but avoid redundant anon policies that trigger
-- Supabase's anonymous-access advisor warning.
drop policy if exists "deny_direct_access_anon" on public.advertisement_target_locations;
drop policy if exists "deny_direct_access_anon" on public.platform_geo_areas;
drop policy if exists "deny_direct_access_anon" on public.platform_global_advertisements;
drop policy if exists "deny_direct_access_anon" on public.smm_providers;
