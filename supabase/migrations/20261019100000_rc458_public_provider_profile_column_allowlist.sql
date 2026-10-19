-- RC458: keep public provider-profile reads limited to explicitly public fields.
-- The existing ACTIVE-only RLS policy remains the row-level publication boundary.
-- This migration removes broad table-level SELECT for PUBLIC/anon and grants only
-- fields used by public discovery; authenticated owner/admin policies are unchanged.
revoke select on table public.marketing_provider_profiles from public, anon;

grant select (
  id, business_id, name_ar, name_en, provider_kind, description,
  service_areas, status, is_verified, is_featured, ranking_weight,
  profile_image_path, updated_at
) on table public.marketing_provider_profiles to anon;
