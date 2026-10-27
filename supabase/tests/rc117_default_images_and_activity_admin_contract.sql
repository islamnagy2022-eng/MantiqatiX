-- RC117 contract checks: deterministic image defaults and activity admin wiring.
do $$
declare
  v_activity text;
  v_product text;
  v_service text;
  v_admin_definition text;
begin
  v_activity := public.mnty_default_image_url('عيادة دكتور منطقتي','خدمات طبية','HEALTHCARE','activity');
  v_product := public.mnty_default_image_url('بن شهريار','قهوة عربية','COFFEE','product');
  v_service := public.mnty_default_image_url('إدارة الحملات الإعلانية','خدمة تسويق رقمي','MARKETING','service');

  if v_activity not like '%photo-1576091160399-112ba8d25d1d%' then
    raise exception 'RC117_ACTIVITY_IMAGE_MAPPING_FAILED: %',v_activity;
  end if;
  if v_product not like '%photo-1501339847302-ac426a4a7cbb%' then
    raise exception 'RC117_PRODUCT_IMAGE_MAPPING_FAILED: %',v_product;
  end if;
  if v_service not like '%photo-1460925895917-afdab827c52f%' then
    raise exception 'RC117_SERVICE_IMAGE_MAPPING_FAILED: %',v_service;
  end if;

  if not exists(select 1 from pg_trigger where tgname='mnty_business_default_images' and not tgisinternal) then
    raise exception 'RC117_BUSINESS_IMAGE_TRIGGER_MISSING';
  end if;
  if not exists(select 1 from pg_trigger where tgname='mnty_catalog_item_default_image' and not tgisinternal) then
    raise exception 'RC117_CATALOG_ITEM_IMAGE_TRIGGER_MISSING';
  end if;
  if not exists(select 1 from pg_trigger where tgname='mnty_marketing_service_default_image' and not tgisinternal) then
    raise exception 'RC117_MARKETING_SERVICE_IMAGE_TRIGGER_MISSING';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='marketing_services' and column_name='image_url') then
    raise exception 'RC117_MARKETING_SERVICE_IMAGE_COLUMN_MISSING';
  end if;
  select pg_get_functiondef('public.mnty_platform_admin_manage_business(uuid,text,jsonb,text)'::regprocedure)
    into v_admin_definition;
  if position('marketing_provider_profiles' in v_admin_definition)=0 then
    raise exception 'RC117_ACTIVITY_NAME_SYNC_MISSING';
  end if;

  if exists (
    select 1 from public.businesses b
    where coalesce(trim(b.settings->'catalog_profile'->>'logo_url'),'')=''
       or coalesce(trim(b.settings->'catalog_profile'->>'cover_url'),'')=''
  ) then
    raise exception 'RC117_EXISTING_BUSINESS_IMAGE_BACKFILL_INCOMPLETE';
  end if;

  if exists (
    select 1 from public.catalog_items i
    where coalesce(trim(i.metadata->'catalog_public'->>'image_url'),'')=''
  ) then
    raise exception 'RC117_EXISTING_CATALOG_ITEM_IMAGE_BACKFILL_INCOMPLETE';
  end if;

  if exists (
    select 1 from public.marketing_services s
    where coalesce(trim(s.image_url),'')=''
  ) then
    raise exception 'RC117_EXISTING_MARKETING_SERVICE_IMAGE_BACKFILL_INCOMPLETE';
  end if;
end;
$;
