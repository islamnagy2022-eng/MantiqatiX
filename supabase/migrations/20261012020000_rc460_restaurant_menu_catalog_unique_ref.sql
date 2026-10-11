-- RC460: enforce one canonical catalog row per restaurant menu item.
-- Fail closed when pre-existing duplicates would make the invariant ambiguous.
-- Reuse an equivalent existing unique index to avoid redundant indexes.
-- Candidate migration only; do not apply to production without release approval.
do $guard$
declare
  v_has_equivalent_unique_index boolean;
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

  select exists (
    select 1
    from pg_catalog.pg_index i
    join pg_catalog.pg_class idx on idx.oid = i.indexrelid
    join pg_catalog.pg_class tbl on tbl.oid = i.indrelid
    join pg_catalog.pg_namespace ns on ns.oid = tbl.relnamespace
    join pg_catalog.pg_attribute a1 on a1.attrelid = tbl.oid and a1.attnum = i.indkey[0]
    join pg_catalog.pg_attribute a2 on a2.attrelid = tbl.oid and a2.attnum = i.indkey[1]
    where ns.nspname = 'public'
      and tbl.relname = 'catalog_items'
      and i.indisunique
      and i.indisvalid
      and i.indnkeyatts >= 2
      and a1.attname = 'business_id'
      and a2.attname = 'legacy_ref'
      and (
        i.indpred is null
        or pg_catalog.pg_get_expr(i.indpred, i.indrelid) ilike '%legacy_ref IS NOT NULL%'
        or pg_catalog.pg_get_expr(i.indpred, i.indrelid) ilike '%legacy_ref LIKE%'
      )
  ) into v_has_equivalent_unique_index;

  if not v_has_equivalent_unique_index then
    create unique index catalog_items_restaurant_menu_legacy_ref_uidx
      on public.catalog_items (business_id, legacy_ref)
      where legacy_ref like 'RESTAURANT_MENU:%';
  end if;
end;
$guard$;
