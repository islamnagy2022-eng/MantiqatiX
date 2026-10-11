-- RC460: enforce one canonical catalog row per restaurant menu item.
-- Fail closed when pre-existing duplicates would make the invariant ambiguous.
-- This is a candidate migration; do not apply to production without release approval.
do $guard$
begin
  if exists (
    select 1
    from public.catalog_items ci
    where ci.legacy_ref like 'RESTAURANT_MENU:%'
    group by ci.business_id, ci.legacy_ref
    having count(*) > 1
  ) then
    raise exception 'RC460_DUPLICATE_RESTAURANT_MENU_CATALOG_REFS';
  end if;
end;
$guard$;

create unique index if not exists catalog_items_restaurant_menu_legacy_ref_uidx
  on public.catalog_items (business_id, legacy_ref)
  where legacy_ref like 'RESTAURANT_MENU:%';
