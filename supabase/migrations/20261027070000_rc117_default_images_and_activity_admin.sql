-- RC117: name-aware default images for activities, products and services.
-- Keeps explicit owner-selected images intact. Platform admin edits remain audited.

create or replace function public.mnty_default_image_url(
  p_name text,
  p_description text,
  p_category text,
  p_kind text default 'product'
)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_text text := lower(coalesce(p_name,'') || ' ' || coalesce(p_description,'') || ' ' || coalesce(p_category,''));
  v_photo text;
  v_width integer := case when lower(coalesce(p_kind,'')) = 'cover' then 1600 else 900 end;
begin
  if v_text ~ '(قهو|بن[[:space:]]|coffee|espresso|cafe|كافيه|محمص)' then v_photo := 'photo-1501339847302-ac426a4a7cbb';
  elsif v_text ~ '(مطعم|وجبات|اكل|أكل|طعام|food|restaurant|bakery|مخبز|حلويات)' then v_photo := 'photo-1517248135467-4c7edcad34c4';
  elsif v_text ~ '(بقال|سوبر.?ماركت|grocery|supermarket|خضار|فاكهه|فاكهة)' then v_photo := 'photo-1542838132-92c53300491e';
  elsif v_text ~ '(عطر|برفيوم|perfume|fragrance|مكياج|تجميل|cosmetic|makeup|beauty|skincare)' then v_photo := 'photo-1541643600914-78b084683601';
  elsif v_text ~ '(ملابس|ازياء|أزياء|fashion|clothing|apparel|shoes|احذيه|أحذية)' then v_photo := 'photo-1483985988355-763728e1935b';
  elsif v_text ~ '(سيار|قطع غيار|auto|car|vehicle|automotive)' then v_photo := 'photo-1492144534655-ae79c964c9d7';
  elsif v_text ~ '(عقار|عقارات|real.?estate|property|شقق|منازل|سكن)' then v_photo := 'photo-1560518883-ce09059eeffa';
  elsif v_text ~ '(صيدل|دواء|أدوية|pharmacy|medicine|medical|عياد|طبيب|دكتور|clinic|hospital|صحه|صحة|health|اسنان|أسنان|تحاليل|معمل|اشعه|أشعة)' then v_photo := 'photo-1576091160399-112ba8d25d1d';
  elsif v_text ~ '(صيان|كهرب|سباك|تكييف|ورشه|ورشة|maintenance|repair|plumb|electric|tools)' then v_photo := 'photo-1621905251189-08b45d6a269e';
  elsif v_text ~ '(تعليم|مدرس|مدرسه|مدرسة|جامعه|جامعة|education|school|course|training|دروس)' then v_photo := 'photo-1503676260728-1c00da094a0b';
  elsif v_text ~ '(سفر|سياح|رحلات|طيران|travel|tour|trip|hotel|vacation)' then v_photo := 'photo-1464822759023-fed622ff2c3b';
  elsif v_text ~ '(وظائف|توظيف|موارد بشرية|jobs|recruit|career|hiring)' then v_photo := 'photo-1521737711867-e3b97375f902';
  elsif v_text ~ '(زواج|اعراس|أعراس|wedding|bride|matrimony|engagement)' then v_photo := 'photo-1519741497674-611481863552';
  elsif v_text ~ '(رياض|لياقه|لياقة|sports|fitness|gym|football|كرة)' then v_photo := 'photo-1461896836934-ffe607ba8211';
  elsif v_text ~ '(تصوير|photography|photograph|camera)' then v_photo := 'photo-1492691527719-9d1e07e534b4';
  elsif v_text ~ '(فيديو|ريلز|video|reel|film production|مونتاج)' then v_photo := 'photo-1574717024653-61fd2cf4d44d';
  elsif v_text ~ '(كتابة|نصوص|copywriting|writing|content writing)' then v_photo := 'photo-1455390582262-044cdead277a';
  elsif v_text ~ '(تصميم|هوية بصرية|شعار|graphic design|branding|logo design)' then v_photo := 'photo-1558655146-d09347e92766';
  elsif v_text ~ '(تحليل|تقارير|analytics|reporting|تحسين محركات|data analysis)' then v_photo := 'photo-1551288049-bebda4e38f71';
  elsif v_text ~ '(إدارة حملات|إدارة الحملات|حملة إعلانية|اعلانات ممولة|إعلانات ممولة|paid ads|advertising campaign)' then v_photo := 'photo-1460925895917-afdab827c52f';
  elsif v_text ~ '(صفحات هبوط|landing page|موقع تسويقي|landing pages)' then v_photo := 'photo-1498050108023-c5249f4df085';
  elsif v_text ~ '(متجر إلكتروني|متاجر إلكترونية|تجارة إلكترونية|ecommerce|e-commerce|تسويق المتاجر)' then v_photo := 'photo-1556742049-0cfed4f6a45d';
  elsif v_text ~ '(استراتيجية|استشارات|consulting|strategy|growth plan|خطة النمو)' then v_photo := 'photo-1521737711867-e3b97375f902';
  elsif v_text ~ '(التواصل الاجتماعي|سوشيال|social media|إدارة حسابات)' then v_photo := 'photo-1516321318423-f06f85e504b3';
  elsif v_text ~ '(تسويق محلي|local marketing|الملفات التجارية|business listing)' then v_photo := 'photo-1497366216548-37526070297c';
  elsif v_text ~ '(تسويق|اعلان|إعلان|حمله|حملة|محتوى|تصميم|marketing|advert|social media|seo|brand|digital)' then v_photo := 'photo-1460925895917-afdab827c52f';
  elsif v_text ~ '(برنامج|برمج|سوفت|تقني|software|technology|tech|computer|web|موقع إلكتروني)' then v_photo := 'photo-1498050108023-c5249f4df085';
  elsif v_text ~ '(اثاث|أثاث|موبيليا|furniture|interior|ديكور|منزل|home|kitchen)' then v_photo := 'photo-1555041469-a586c61ea9bc';
  elsif v_text ~ '(كتاب|كتب|قرطاسيه|قرطاسية|book|stationery|مكتبه|مكتبة)' then v_photo := 'photo-1507842217343-583bb7270b66';
  elsif v_text ~ '(حيوان|بيطر|pet|veterinary|vet|dogs|cats)' then v_photo := 'photo-1450778869180-41d0601e046e';
  elsif v_text ~ '(زهور|ورد|نبات|flowers|flower|plants|florist)' then v_photo := 'photo-1490750967868-88aa4486c946';
  elsif v_text ~ '(الكترون|إلكترون|موبايل|هاتف|كمبيوتر|electronics|phone|laptop|device)' then v_photo := 'photo-1518770660439-4636190af475';
  elsif lower(coalesce(p_kind,'')) = 'service' then v_photo := 'photo-1521737711867-e3b97375f902';
  elsif lower(coalesce(p_kind,'')) in ('activity','cover') then v_photo := 'photo-1497366216548-37526070297c';
  else v_photo := 'photo-1491553895911-0055eca6402d';
  end if;

  return 'https://images.unsplash.com/' || v_photo ||
    '?auto=format&fit=crop&crop=entropy&w=' || v_width::text || '&q=85';
end;
$function$;

create or replace function public.mnty_default_business_images_trigger()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_settings jsonb := coalesce(new.settings,'{}'::jsonb);
  v_profile jsonb := coalesce(v_settings->'catalog_profile','{}'::jsonb);
  v_old_profile jsonb := '{}'::jsonb;
  v_category text := coalesce(v_profile->>'category',v_settings->>'category_code',v_settings->>'activity_code',v_settings->>'headline','');
  v_description text := coalesce(v_profile->>'bio',v_settings->>'headline','');
  v_logo text := nullif(trim(coalesce(v_profile->>'logo_url','')),'');
  v_cover text := nullif(trim(coalesce(v_profile->>'cover_url','')),'');
  v_logo_source text := lower(coalesce(v_profile->>'logo_image_source',''));
  v_cover_source text := lower(coalesce(v_profile->>'cover_image_source',''));
begin
  if tg_op = 'UPDATE' then
    v_old_profile := coalesce(old.settings->'catalog_profile','{}'::jsonb);
    if (v_profile->>'logo_url') is distinct from (v_old_profile->>'logo_url')
       and (v_profile->>'logo_image_source') is not distinct from (v_old_profile->>'logo_image_source') then
      v_logo_source := 'owner';
    end if;
    if (v_profile->>'cover_url') is distinct from (v_old_profile->>'cover_url')
       and (v_profile->>'cover_image_source') is not distinct from (v_old_profile->>'cover_image_source') then
      v_cover_source := 'owner';
    end if;
  end if;

  if v_logo is null or v_logo_source = 'auto' then
    v_logo := public.mnty_default_image_url(new.name,v_description,v_category,'activity');
    v_logo_source := 'auto';
  elsif v_logo_source not in ('auto','owner') then
    v_logo_source := 'owner';
  end if;

  if v_cover is null or v_cover_source = 'auto' then
    v_cover := public.mnty_default_image_url(new.name,v_description,v_category,'cover');
    v_cover_source := 'auto';
  elsif v_cover_source not in ('auto','owner') then
    v_cover_source := 'owner';
  end if;

  v_profile := v_profile || jsonb_build_object(
    'logo_url',v_logo,'cover_url',v_cover,
    'logo_image_source',v_logo_source,'cover_image_source',v_cover_source
  );
  new.settings := jsonb_set(v_settings,'{catalog_profile}',v_profile,true);
  return new;
end;
$function$;

drop trigger if exists mnty_business_default_images on public.businesses;
create trigger mnty_business_default_images
before insert or update of name, settings on public.businesses
for each row execute function public.mnty_default_business_images_trigger();

create or replace function public.mnty_default_catalog_item_image_trigger()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_metadata jsonb := coalesce(new.metadata,'{}'::jsonb);
  v_public jsonb := coalesce(v_metadata->'catalog_public','{}'::jsonb);
  v_old_public jsonb := '{}'::jsonb;
  v_image text := nullif(trim(coalesce(v_public->>'image_url','')),'');
  v_source text := lower(coalesce(v_public->>'image_source',''));
  v_name text := coalesce(new.name_ar,new.name_en,'');
  v_category text := coalesce(v_public->>'category','');
begin
  if tg_op = 'UPDATE' then
    v_old_public := coalesce(old.metadata->'catalog_public','{}'::jsonb);
    if (v_public->>'image_url') is distinct from (v_old_public->>'image_url')
       and (v_public->>'image_source') is not distinct from (v_old_public->>'image_source') then
      v_source := 'owner';
    end if;
  end if;

  if v_image is null or v_source = 'auto' then
    v_image := public.mnty_default_image_url(v_name,new.description,v_category,
      case when upper(coalesce(new.item_type,'')) = 'SERVICE' then 'service' else 'product' end);
    v_source := 'auto';
  elsif v_source not in ('auto','owner') then
    v_source := 'owner';
  end if;

  v_public := v_public || jsonb_build_object('image_url',v_image,'image_source',v_source);
  new.metadata := jsonb_set(v_metadata,'{catalog_public}',v_public,true);
  return new;
end;
$function$;

drop trigger if exists mnty_catalog_item_default_image on public.catalog_items;
create trigger mnty_catalog_item_default_image
before insert or update of name_ar, name_en, description, item_type, metadata on public.catalog_items
for each row execute function public.mnty_default_catalog_item_image_trigger();

alter table public.marketing_services add column if not exists image_url text;
alter table public.marketing_services add column if not exists image_source varchar(16);

create or replace function public.mnty_default_marketing_service_image_trigger()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_image text := nullif(trim(coalesce(new.image_url,'')),'');
  v_source text := lower(coalesce(new.image_source,''));
begin
  if tg_op = 'UPDATE' and new.image_url is distinct from old.image_url
     and new.image_source is not distinct from old.image_source then
    v_source := 'owner';
  end if;

  if v_image is null or v_source = 'auto' then
    v_image := public.mnty_default_image_url(new.name_ar,
      coalesce(new.description,new.name_en),new.category_code,'service');
    v_source := 'auto';
  elsif v_source not in ('auto','owner') then
    v_source := 'owner';
  end if;
  new.image_url := v_image;
  new.image_source := v_source;
  return new;
end;
$function$;

drop trigger if exists mnty_marketing_service_default_image on public.marketing_services;
create trigger mnty_marketing_service_default_image
before insert or update of name_ar,name_en,description,category_code,image_url,image_source on public.marketing_services
for each row execute function public.mnty_default_marketing_service_image_trigger();

-- Existing catalog items with blank images or the old generic placeholder get
-- category-aware defaults. Custom, already-supplied URLs are preserved.
update public.catalog_items
set metadata = jsonb_set(
  coalesce(metadata,'{}'::jsonb),
  '{catalog_public}',
  coalesce(metadata->'catalog_public','{}'::jsonb) ||
    jsonb_build_object('image_url',public.mnty_default_image_url(
      coalesce(name_ar,name_en,''),description,
      coalesce(metadata->'catalog_public'->>'category',''),
      case when upper(coalesce(item_type,''))='SERVICE' then 'service' else 'product' end
    ),'image_source','auto'),
  true
)
where coalesce(metadata->'catalog_public'->>'image_url','')=''
   or (coalesce(metadata->'catalog_public'->>'image_source','')='' and metadata->'catalog_public'->>'image_url' like '%photo-1544816155-12df9643f363%');

update public.marketing_services
set image_url = public.mnty_default_image_url(name_ar,description,category_code,'service'),
    image_source = 'auto'
where coalesce(image_url,'')='' or coalesce(image_source,'')='';

-- Run the business trigger for existing records that have missing default image values.
update public.businesses
set settings = coalesce(settings,'{}'::jsonb)
where coalesce(settings->'catalog_profile'->>'logo_url','')=''
   or coalesce(settings->'catalog_profile'->>'cover_url','')=''
   or coalesce(settings->'catalog_profile'->>'logo_image_source','')=''
   or coalesce(settings->'catalog_profile'->>'cover_image_source','')='';

create or replace function public.mnty_platform_admin_manage_business(
  p_business_id uuid,
  p_name text,
  p_settings jsonb default null,
  p_action text default 'UPDATE'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_business public.businesses%rowtype;
  v_old jsonb;
  v_action text := upper(coalesce(p_action,'UPDATE'));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if v_action not in ('UPDATE','DEACTIVATE','RESTORE') then raise exception 'INVALID_BUSINESS_ACTION'; end if;
  select * into v_business from public.businesses where id=p_business_id for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;

  v_old:=jsonb_build_object('name',v_business.name,'status',v_business.status,'settings',v_business.settings);
  if v_action='UPDATE' then
    if nullif(trim(p_name),'') is null then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
    update public.businesses
      set name=trim(p_name),
          settings=case when p_settings is null then v_business.settings else coalesce(v_business.settings,'{}'::jsonb) || p_settings end,
          updated_at=now()
      where id=p_business_id returning * into v_business;

    -- The official activity card uses this provider name first. Keep it aligned
    -- with the owner-controlled activity record when the platform edits it.
    update public.marketing_provider_profiles p
      set name_ar=trim(p_name),
          name_en=case when nullif(trim(coalesce(p_settings->'catalog_profile'->>'name_en','')),'') is not null
            then trim(p_settings->'catalog_profile'->>'name_en') else trim(p_name) end,
          description=coalesce(nullif(trim(coalesce(v_business.settings->'catalog_profile'->>'bio','')),''),p.description),
          updated_at=now()
      where p.business_id=v_business.id
        and (p.settings->>'managed_by'='SUPER_ADMIN' or p.settings->>'source'='OFFICIAL_PLATFORM_SHOWCASE');
  elsif v_action='DEACTIVATE' then
    update public.businesses set status='INACTIVE',updated_at=now() where id=p_business_id returning * into v_business;
  else
    update public.businesses set status='ACTIVE',updated_at=now() where id=p_business_id returning * into v_business;
  end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,v_business.tenant_id,v_actor,
    case v_action when 'UPDATE' then 'PLATFORM_BUSINESS_UPDATED' when 'DEACTIVATE' then 'PLATFORM_BUSINESS_DEACTIVATED' else 'PLATFORM_BUSINESS_RESTORED' end,
    'business',v_business.id::text,v_old,
    jsonb_build_object('name',v_business.name,'status',v_business.status,'settings',v_business.settings),'SUCCESS');

  return jsonb_build_object('id',v_business.id,'name',v_business.name,'status',v_business.status,'settings',v_business.settings);
end;
$function$;

revoke all on function public.mnty_default_image_url(text,text,text,text) from public,anon;
grant execute on function public.mnty_default_image_url(text,text,text,text) to authenticated,service_role;
