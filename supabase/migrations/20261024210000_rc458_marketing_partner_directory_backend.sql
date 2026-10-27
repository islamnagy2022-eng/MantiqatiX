-- RC458: expose a minimal, authenticated directory for cross-business marketing partners.
-- The browser's provider-profile SELECT policy is intentionally tenant/business scoped;
-- do not widen that table policy just to populate the invitation picker.
create or replace function public.list_marketing_partner_directory_backend(
  p_actor uuid,
  p_business_id uuid,
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  name_ar text,
  name_en text,
  slug text,
  provider_kind text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_search text;
  v_limit integer;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_actor is distinct from auth.uid() then
    raise exception 'ACTOR_MISMATCH';
  end if;
  if not public.mnty_can_manage_marketing_business(p_business_id) then
    raise exception 'MARKETING_BUSINESS_SCOPE_REQUIRED';
  end if;

  v_search := nullif(pg_catalog.btrim(coalesce(p_search, '')), '');
  if v_search is not null and pg_catalog.length(v_search) > 80 then
    raise exception 'MARKETING_PARTNER_SEARCH_TOO_LONG';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 50);

  return query
  select p.id,
         p.name_ar::text,
         p.name_en::text,
         p.slug::text,
         p.provider_kind::text
  from public.marketing_provider_profiles p
  where p.status = 'ACTIVE'
    and p.is_verified is true
    and p.provider_kind in ('PARTNER_COMPANY', 'FREELANCER')
    and p.owner_user_id is not null
    and (p.business_id is null or p.business_id <> p_business_id)
    and (
      v_search is null
      or pg_catalog.strpos(pg_catalog.lower(coalesce(p.name_ar, '')), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(p.name_en, '')), pg_catalog.lower(v_search)) > 0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(p.slug, '')), pg_catalog.lower(v_search)) > 0
    )
  order by pg_catalog.lower(coalesce(p.name_ar, p.name_en, p.slug, '')), p.id
  limit v_limit;
end;
$function$;

revoke all on function public.list_marketing_partner_directory_backend(uuid, uuid, text, integer) from public, anon;
grant execute on function public.list_marketing_partner_directory_backend(uuid, uuid, text, integer) to authenticated;
