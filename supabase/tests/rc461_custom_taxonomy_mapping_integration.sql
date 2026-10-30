-- RC461 custom category mapping integration. Disposable PostgreSQL only.
do $test$
declare
  admin_id constant uuid := '46100000-0000-4000-8000-000000000001';
  source_custom constant text := 'cat_custom_11111111-1111-4111-8111-111111111111';
  target_custom constant text := 'cat_custom_22222222-2222-4222-8222-222222222222';
  profession_custom constant text := 'cat_custom_33333333-3333-4333-8333-333333333333';
  wrong_group_custom constant text := 'cat_custom_55555555-5555-4555-8555-555555555555';
  invalid_custom constant text := 'cat_custom_44444444-4444-4444-8444-444444444444';
  business_a constant uuid := '46100000-0000-4000-8000-000000000011';
  business_b constant uuid := '46100000-0000-4000-8000-000000000012';
  listing_a constant uuid := '46100000-0000-4000-8000-000000000021';
  listing_b constant uuid := '46100000-0000-4000-8000-000000000022';
  preview jsonb;
  applied jsonb;
  digest text;
  audit_count integer;
  rejected boolean;
begin
  insert into auth.users(id) values (admin_id);
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions)
  values (
    '46100000-0000-4000-8000-000000000101',admin_id,'MNTY-PLATFORM',
    'SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb
  );

  insert into public.bizcatalog_platform_settings(settings_key,settings,updated_by)
  values (
    'bizcatalog',
    jsonb_build_object('categories',jsonb_build_array(
      jsonb_build_object('id',source_custom,'name','مقهى مخصص مصدر','functionalGroupId','food_grocery','classificationType','activity','isCustom',true),
      jsonb_build_object('id',target_custom,'name','مقهى مخصص وجهة','functionalGroupId','food_grocery','classificationType','activity','isCustom',true),
      jsonb_build_object('id',profession_custom,'name','خبير قهوة مخصص','functionalGroupId','food_grocery','classificationType','profession','isCustom',true),
      jsonb_build_object('id',wrong_group_custom,'name','تصنيف مخصص بمجال مختلف','functionalGroupId','medical_health','classificationType','activity','isCustom',true)
    )),
    admin_id
  );

  insert into public.businesses(id,tenant_id,name,settings)
  values
    (business_a,'MNTY-PLATFORM','Custom Business A',
      jsonb_build_object(
        'activity_group_code','food_grocery',
        'activity_category_id',source_custom,
        'activity_classification_type','activity',
        'activity_specialty','قهوة مختصة',
        'category_code','اسم النشاط الأصلي',
        'bizcatalog',jsonb_build_object('paymentStatus','paid','publicationStatus','PUBLISHED')
      )),
    (business_b,'MNTY-PLATFORM','Custom Business B',
      jsonb_build_object(
        'activity_group_code','food_grocery',
        'activity_category_id',source_custom,
        'activity_classification_type','activity',
        'activity_specialty','مشروبات ساخنة',
        'category_code','اسم النشاط الأصلي'
      ));

  insert into public.public_directory_listings(
    id,display_name,functional_group_id,taxonomy_category_id,taxonomy_specialty,
    listing_status,claim_status,phone
  ) values
    (listing_a,'Custom Listing A','food_grocery',source_custom,'قهوة مختصة','PUBLISHED','CLAIMED','01011111111'),
    (listing_b,'Custom Listing B','food_grocery',source_custom,'مشروبات ساخنة','HIDDEN','UNCLAIMED','01022222222');

  -- RC460 audit trigger must record custom definitions created by the platform admin.
  if not exists (
    select 1 from public.catalog_taxonomy_definition_audit
    where actor_user_id=admin_id
      and after_taxonomy->'categories' @> jsonb_build_array(jsonb_build_object('id',source_custom))
  ) then
    raise exception 'RC461_CUSTOM_DEFINITION_AUDIT_MISSING';
  end if;

  -- A fabricated custom ID is rejected even though it has the expected UUID shape.
  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_preview(
      admin_id,'food_grocery',invalid_custom,
      'food_grocery','cat_food_grocery_cafes','activity'
    );
    raise exception 'RC461_UNKNOWN_CUSTOM_SOURCE_ACCEPTED';
  exception when others then
    if sqlerrm <> 'TAXONOMY_CUSTOM_SOURCE_NOT_FOUND' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC461_UNKNOWN_CUSTOM_SOURCE_NOT_REJECTED'; end if;

  -- A custom category registered under another functional group is not a valid target.
  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_preview(
      admin_id,'food_grocery',source_custom,
      'food_grocery',wrong_group_custom,'activity'
    );
    raise exception 'RC461_CUSTOM_TARGET_WRONG_GROUP_ACCEPTED';
  exception when others then
    if sqlerrm <> 'TAXONOMY_CUSTOM_TARGET_NOT_FOUND' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC461_CUSTOM_TARGET_WRONG_GROUP_NOT_REJECTED'; end if;

  -- Custom -> canonical: preview has exact row counts, no writes, and preserves stable identity.
  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery',source_custom,
    'food_grocery','cat_food_grocery_cafes','activity'
  );
  if (preview->>'businessCount')::integer <> 2
     or (preview->>'listingCount')::integer <> 2
     or (preview->>'totalCount')::integer <> 4 then
    raise exception 'RC461_CUSTOM_SOURCE_PREVIEW_COUNTS_INVALID: %',preview;
  end if;
  digest := preview->>'previewDigest';
  update public.businesses set updated_at=updated_at + interval '1 second' where id=business_a;
  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_apply(
      admin_id,'food_grocery',source_custom,
      'food_grocery','cat_food_grocery_cafes','activity',digest
    );
    raise exception 'RC461_STALE_PREVIEW_WAS_APPLIED';
  exception when others then
    if sqlerrm <> 'TAXONOMY_PREVIEW_STALE' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC461_STALE_PREVIEW_NOT_REJECTED'; end if;

  if (select settings->>'activity_category_id' from public.businesses where id=business_a) <> source_custom then
    raise exception 'RC461_CUSTOM_SOURCE_PREVIEW_WROTE_DATA';
  end if;

  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery',source_custom,
    'food_grocery','cat_food_grocery_cafes','activity'
  );

  applied := public.mnty_catalog_taxonomy_mapping_apply(
    admin_id,'food_grocery',source_custom,
    'food_grocery','cat_food_grocery_cafes','activity',preview->>'previewDigest'
  );
  if applied->>'success' <> 'true'
     or (applied->>'businessCount')::integer <> 2
     or (applied->>'listingCount')::integer <> 2 then
    raise exception 'RC461_CUSTOM_TO_CANONICAL_APPLY_INVALID: %',applied;
  end if;
  if (select settings->>'activity_category_id' from public.businesses where id=business_a) <> 'cat_food_grocery_cafes'
     or (select settings->>'activity_category_code' from public.businesses where id=business_a) <> 'cafes'
     or (select settings->>'activity_specialty' from public.businesses where id=business_a) <> 'قهوة مختصة'
     or (select settings->'bizcatalog'->>'paymentStatus' from public.businesses where id=business_a) <> 'paid'
     or (select taxonomy_category_id from public.public_directory_listings where id=listing_a) <> 'cat_food_grocery_cafes'
     or (select taxonomy_specialty from public.public_directory_listings where id=listing_a) <> 'قهوة مختصة'
     or (select listing_status from public.public_directory_listings where id=listing_b) <> 'HIDDEN'
     or (select claim_status from public.public_directory_listings where id=listing_a) <> 'CLAIMED'
     or (select phone from public.public_directory_listings where id=listing_a) <> '01011111111' then
    raise exception 'RC461_CUSTOM_TO_CANONICAL_CHANGED_UNRELATED_FIELDS';
  end if;

  -- Canonical -> saved custom: the stable custom ID is restored and the canonical code is removed.
  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery','cat_food_grocery_cafes',
    'food_grocery',target_custom,'activity'
  );
  applied := public.mnty_catalog_taxonomy_mapping_apply(
    admin_id,'food_grocery','cat_food_grocery_cafes',
    'food_grocery',target_custom,'activity',preview->>'previewDigest'
  );
  if (select settings->>'activity_category_id' from public.businesses where id=business_a) <> target_custom
     or (select settings ? 'activity_category_code' from public.businesses where id=business_a) is distinct from false then
    raise exception 'RC461_CANONICAL_TO_CUSTOM_BUSINESS_ID_INVALID';
  end if;
  if (select taxonomy_category_id from public.public_directory_listings where id=listing_a) <> target_custom then
    raise exception 'RC461_CANONICAL_TO_CUSTOM_LISTING_ID_INVALID';
  end if;

  -- Registered custom -> another registered custom category.
  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery',target_custom,
    'food_grocery',source_custom,'activity'
  );
  applied := public.mnty_catalog_taxonomy_mapping_apply(
    admin_id,'food_grocery',target_custom,
    'food_grocery',source_custom,'activity',preview->>'previewDigest'
  );
  if applied->>'success' <> 'true'
     or (select settings->>'activity_category_id' from public.businesses where id=business_a) <> source_custom
     or (select taxonomy_category_id from public.public_directory_listings where id=listing_a) <> source_custom then
    raise exception 'RC461_CUSTOM_TO_CUSTOM_APPLY_FAILED: %',applied;
  end if;

  -- A profession-only custom category cannot receive an activity mapping.
  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_preview(
      admin_id,'food_grocery','cat_food_grocery_cafes',
      'food_grocery',profession_custom,'activity'
    );
    raise exception 'RC461_CUSTOM_TARGET_TYPE_MISMATCH_ACCEPTED';
  exception when others then
    if sqlerrm <> 'TAXONOMY_CUSTOM_TARGET_TYPE_MISMATCH' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC461_CUSTOM_TARGET_TYPE_MISMATCH_NOT_REJECTED'; end if;

  select count(*) into audit_count
  from public.catalog_taxonomy_mapping_audit
  where actor_user_id=admin_id;
  if audit_count <> 3 then
    raise exception 'RC461_CUSTOM_MAPPING_AUDIT_COUNT_INVALID: %',audit_count;
  end if;

  if has_function_privilege('anon','public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'RC461_PRIVILEGED_RPC_EXPOSED_TO_API_ROLES';
  end if;
  if has_table_privilege('anon','public.catalog_taxonomy_mapping_audit','SELECT')
     or has_table_privilege('authenticated','public.catalog_taxonomy_mapping_audit','SELECT')
     or has_table_privilege('service_role','public.catalog_taxonomy_mapping_audit','SELECT') then
    raise exception 'RC461_MAPPING_AUDIT_DIRECT_READ_ALLOWED';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_class c
    where c.oid='public.catalog_taxonomy_mapping_audit'::regclass
      and c.relrowsecurity=true and c.relforcerowsecurity=true
  ) then
    raise exception 'RC461_MAPPING_AUDIT_RLS_NOT_FORCED';
  end if;
end;
$test$;

select 'RC461 custom taxonomy mapping integration: PASS' as result;
