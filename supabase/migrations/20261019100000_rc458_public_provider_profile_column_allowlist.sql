-- RC458: publish a read-only ACTIVE provider directory through a column allowlist.
-- Keep owner/admin access on the base table governed by existing policies; ordinary
-- authenticated visitors use the public view, not the base table's private columns.
alter table public.marketing_provider_profiles enable row level security;

drop policy if exists "Public can view active marketing providers"
  on public.marketing_provider_profiles;
drop policy if exists marketing_provider_profiles_public_active_read
  on public.marketing_provider_profiles;

revoke all on table public.marketing_provider_profiles from public, anon;

create or replace view public.marketing_provider_profiles_public
with (security_barrier = true)
as
select id, business_id, name_ar, name_en, provider_kind, description,
       service_areas, status, is_verified, is_featured, ranking_weight,
       profile_image_path, updated_at
from public.marketing_provider_profiles
where status = 'ACTIVE';

revoke all on table public.marketing_provider_profiles_public from public, anon, authenticated;
grant select on table public.marketing_provider_profiles_public to anon, authenticated;
