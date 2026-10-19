-- RC458: restore anonymous ACTIVE-only provider discovery and limit public fields.
-- The existing ACTIVE-only RLS policy remains the row-level publication boundary.
-- This migration removes broad table-level SELECT for PUBLIC/anon and grants only
-- fields used by public discovery; authenticated owner/admin policies are unchanged.
alter table public.marketing_provider_profiles enable row level security;

drop policy if exists "Public can view active marketing providers"
  on public.marketing_provider_profiles;
drop policy if exists marketing_provider_profiles_public_active_read
  on public.marketing_provider_profiles;

create policy marketing_provider_profiles_public_active_read
on public.marketing_provider_profiles
for select to anon, authenticated
using (status = 'ACTIVE');

revoke select on table public.marketing_provider_profiles from public, anon;

grant select (
  id, business_id, name_ar, name_en, provider_kind, description,
  service_areas, status, is_verified, is_featured, ranking_weight,
  profile_image_path, updated_at
) on table public.marketing_provider_profiles to anon;
