-- RC459 transactional taxonomy mapping integration. Disposable PostgreSQL only.
do $test$
declare
  admin_id constant uuid := '45900000-0000-4000-8000-000000000001';
  owner_id constant uuid := '45900000-0000-4000-8000-000000000002';
  business_a constant uuid := '45900000-0000-4000-8000-000000000011';
  business_b constant uuid := '45900000-0000-4000-8000-000000000012';
  business_other constant uuid := '45900000-0000-4000-8000-000000000013';
  listing_a constant uuid := '45900000-0000-4000-8000-000000000021';
  listing_b constant uuid := '45900000-0000-4000-8000-000000000022';
  listing_other constant uuid := '45900000-0000-4000-8000-000000000023';
  preview jsonb;
  result jsonb;
  digest text;
  rejected boolean;
  audit_before integer;
  n integer;
begin
  insert into auth.users(id) values (admin_id),(owner_id);
  insert into public.user_memberships(id,user_id,tenant_id,role,status,permissions)
  values
   ('45900000-0000-4000-8000-000000000101',admin_id,'MNTY-PLATFORM','SUPER_ADMIN','ACTIVE','{"scope":"PLATFORM","full_control":true}'::jsonb),
   ('45900000-0000-4000-8000-000000000102',owner_id,'MNTY-PLATFORM','OWNER','ACTIVE','{"scope":"BUSINESS"}'::jsonb);

  insert into public.businesses(id,tenant_id,name,settings)
  values
    (business_a,'MNTY-PLATFORM','Business A','{"activity_group_code":"food_grocery","activity_category_code":"cafes","activity_classification_type":"activity","activity_specialty":"قهوة مختصة","bizcatalog":{"paymentStatus":"paid"},"unrelated":"keep"}'::jsonb),
    (business_b,'MNTY-PLATFORM','Business B','{"activity_group_code":"food_grocery","activity_category_code":"cafes","activity_classification_type":"activity","activity_specialty":"مقهى","custom_flag":true}'::jsonb),
    (business_other,'MNTY-PLATFORM','Business Other','{"activity_group_code":"food_grocery","activity_category_code":"restaurants","activity_classification_type":"activity"}'::jsonb);

  insert into public.public_directory_listings(
    id,display_name,functional_group_id,taxonomy_category_id,taxonomy_specialty,
    listing_status,claim_status,phone
  ) values
    (listing_a,'Listing A','food_grocery','cat_food_grocery_cafes','قهوة مختصة','PUBLISHED','UNCLAIMED','01000000001'),
    (listing_b,'Listing B','food_grocery','cat_food_grocery_cafes','مخبوزات ومشروبات','HIDDEN','CLAIMED','01000000002'),
    (listing_other,'Listing Other','food_grocery','cat_food_grocery_restaurants','مشويات','PUBLISHED','UNCLAIMED','01000000003');

  if has_function_privilege('anon','public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'RC459_API_ROLE_EXECUTE_MUST_BE_REVOKED';
  end if;
  if not has_function_privilege('service_role','public.mnty_catalog_taxonomy_mapping_preview(uuid,text,text,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.mnty_catalog_taxonomy_mapping_apply(uuid,text,text,text,text,text,text)','EXECUTE') then
    raise exception 'RC459_SERVICE_ROLE_EXECUTE_MISSING';
  end if;
  if has_table_privilege('service_role','public.catalog_taxonomy_mapping_audit','SELECT')
     or has_table_privilege('service_role','public.catalog_taxonomy_mapping_audit','INSERT') then
    raise exception 'RC459_AUDIT_TABLE_DIRECT_ACCESS_MUST_BE_REVOKED';
  end if;

  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_preview(
      owner_id,'food_grocery','cat_food_grocery_cafes',
      'food_grocery','cat_food_grocery_restaurants','activity'
    );
    raise exception 'RC459_NON_PLATFORM_ADMIN_PREVIEW_SUCCEEDED';
  exception when others then
    if sqlerrm <> 'PLATFORM_ADMIN_REQUIRED' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_NON_PLATFORM_ADMIN_NOT_REJECTED'; end if;

  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_preview(
      admin_id,'food_grocery','cat_medical_health_pharmacies',
      'food_grocery','cat_food_grocery_restaurants','activity'
    );
    raise exception 'RC459_INVALID_SOURCE_GROUP_CATEGORY_ACCEPTED';
  exception when others then
    if sqlerrm <> 'TAXONOMY_INVALID_CATEGORY_ID' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_INVALID_MAPPING_NOT_REJECTED'; end if;

  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery','cat_food_grocery_cafes',
    'food_grocery','cat_food_grocery_restaurants','activity'
  );
  if (preview->>'businessCount')::integer <> 2
     or (preview->>'listingCount')::integer <> 2
     or (preview->>'totalCount')::integer <> 4
     or preview->>'canApply' <> 'true' then
    raise exception 'RC459_PREVIEW_COUNTS_INVALID: %',preview;
  end if;
  digest := preview->>'previewDigest';

  -- Preview is read-only.
  if (select count(*) from public.businesses where settings->>'activity_category_code'='cafes') <> 2
     or (select count(*) from public.public_directory_listings where taxonomy_category_id='cat_food_grocery_cafes') <> 2 then
    raise exception 'RC459_PREVIEW_MODIFIED_SOURCE_ROWS';
  end if;

  -- Change the source snapshot to prove stale previews are rejected before writing.
  update public.businesses set updated_at=updated_at + interval '1 second' where id=business_a;
  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_apply(
      admin_id,'food_grocery','cat_food_grocery_cafes',
      'food_grocery','cat_food_grocery_restaurants','activity',digest
    );
    raise exception 'RC459_STALE_PREVIEW_WAS_APPLIED';
  exception when others then
    if sqlerrm <> 'TAXONOMY_PREVIEW_STALE' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_STALE_PREVIEW_NOT_REJECTED'; end if;

  -- Refresh the preview after the deliberate source timestamp change.
  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery','cat_food_grocery_cafes',
    'food_grocery','cat_food_grocery_restaurants','activity'
  );
  digest := preview->>'previewDigest';
  select count(*) into audit_before from public.catalog_taxonomy_mapping_audit;

  -- Force a second-table failure. The earlier business update and audit insert must roll back.
  create or replace function public.rc459_force_listing_failure()
  returns trigger language plpgsql as $function$
  begin raise exception 'RC459_FORCED_TRANSACTION_FAILURE'; end;
  $function$;
  create trigger rc459_force_listing_failure
  before update on public.public_directory_listings
  for each row execute function public.rc459_force_listing_failure();

  rejected := false;
  begin
    perform public.mnty_catalog_taxonomy_mapping_apply(
      admin_id,'food_grocery','cat_food_grocery_cafes',
      'food_grocery','cat_food_grocery_restaurants','activity',digest
    );
    raise exception 'RC459_EXPECTED_FORCED_FAILURE_NOT_RAISED';
  exception when others then
    if sqlerrm <> 'RC459_FORCED_TRANSACTION_FAILURE' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_ATOMIC_FAILURE_NOT_OBSERVED'; end if;
  drop trigger rc459_force_listing_failure on public.public_directory_listings;
  drop function public.rc459_force_listing_failure();

  if (select settings->>'activity_category_code' from public.businesses where id=business_a) <> 'cafes'
     or (select taxonomy_category_id from public.public_directory_listings where id=listing_a) <> 'cat_food_grocery_cafes'
     or (select count(*) from public.catalog_taxonomy_mapping_audit) <> audit_before then
    raise exception 'RC459_PARTIAL_WRITE_AFTER_FAILURE';
  end if;

  -- Commit a fresh validated preview.
  preview := public.mnty_catalog_taxonomy_mapping_preview(
    admin_id,'food_grocery','cat_food_grocery_cafes',
    'food_grocery','cat_food_grocery_restaurants','activity'
  );
  result := public.mnty_catalog_taxonomy_mapping_apply(
    admin_id,'food_grocery','cat_food_grocery_cafes',
    'food_grocery','cat_food_grocery_restaurants','activity',preview->>'previewDigest'
  );
  if result->>'success' <> 'true'
     or (result->>'businessCount')::integer <> 2
     or (result->>'listingCount')::integer <> 2 then
    raise exception 'RC459_COMMIT_RESULT_INVALID: %',result;
  end if;

  if (select count(*) from public.businesses
      where settings->>'activity_group_code'='food_grocery'
        and settings->>'activity_category_code'='restaurants') <> 3 then
    raise exception 'RC459_BUSINESS_RECLASSIFICATION_COUNT_INVALID';
  end if;
  if (select count(*) from public.public_directory_listings
      where taxonomy_category_id='cat_food_grocery_restaurants') <> 3 then
    raise exception 'RC459_LISTING_RECLASSIFICATION_COUNT_INVALID';
  end if;
  if (select settings->>'activity_specialty' from public.businesses where id=business_a) <> 'قهوة مختصة'
     or (select settings->>'unrelated' from public.businesses where id=business_a) <> 'keep'
     or (select settings->'bizcatalog'->>'paymentStatus' from public.businesses where id=business_a) <> 'paid'
     or (select taxonomy_specialty from public.public_directory_listings where id=listing_a) <> 'قهوة مختصة'
     or (select listing_status from public.public_directory_listings where id=listing_b) <> 'HIDDEN'
     or (select claim_status from public.public_directory_listings where id=listing_b) <> 'CLAIMED'
     or (select phone from public.public_directory_listings where id=listing_a) <> '01000000001' then
    raise exception 'RC459_UNRELATED_DATA_WAS_CHANGED';
  end if;

  if not exists (
    select 1 from public.catalog_taxonomy_mapping_audit
    where id=(result->>'auditId')::uuid and actor_user_id=admin_id
      and affected_business_count=2 and affected_listing_count=2
      and jsonb_array_length(before_image->'businesses')=2
      and jsonb_array_length(before_image->'directoryListings')=2
  ) then raise exception 'RC459_AUDIT_SNAPSHOT_MISSING'; end if;

  rejected := false;
  begin
    update public.catalog_taxonomy_mapping_audit
    set after_mapping='{}'::jsonb where id=(result->>'auditId')::uuid;
    raise exception 'RC459_AUDIT_ROW_MUTATED';
  exception when others then
    if sqlerrm <> 'CATALOG_TAXONOMY_AUDIT_APPEND_ONLY' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'RC459_AUDIT_IMMUTABILITY_NOT_ENFORCED'; end if;

end;
$test$;

select 'RC459 secure taxonomy mapping preview/commit integration: PASS' as result;
