-- RC461: expose a sanitized public provider directory without granting anon direct table access.
-- Forward-only. Keep authenticated owner/CRM access governed by existing table grants and RLS.

create or replace view public.public_marketing_provider_profiles
with (security_barrier = true)
as
select
  p.id,
  p.business_id,
  p.name_ar,
  p.name_en,
  p.provider_kind,
  p.description,
  p.service_areas,
  p.status,
  p.is_verified,
  p.is_featured,
  p.profile_image_path,
  nullif(p.settings #>> '{branding,logo_path}', '') as public_branding_logo_path,
  p.created_at,
  p.updated_at
from public.marketing_provider_profiles p
where p.status = 'ACTIVE';

revoke all on public.public_marketing_provider_profiles from public;
grant select on public.public_marketing_provider_profiles to anon, authenticated;

-- Public clients must use the allowlisted view, never the full internal row.
revoke all privileges on public.marketing_provider_profiles from anon;

-- Also remove any column-level SELECT grants, which table-level REVOKE alone does not remove.
do $
declare
  v_column record;
begin
  for v_column in
    select a.attname
    from pg_attribute a
    where a.attrelid = 'public.marketing_provider_profiles'::regclass
      and a.attnum > 0
      and not a.attisdropped
  loop
    execute format('revoke select (%I) on table public.marketing_provider_profiles from anon', v_column.attname);
  end loop;
end $;
