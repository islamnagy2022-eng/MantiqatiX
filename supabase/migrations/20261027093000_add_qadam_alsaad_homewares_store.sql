-- MantiqatiX: register the Qadam Al-Saad homewares store and visible catalog products.
-- Idempotent by (tenant_id, code) and (business_id, legacy_ref); no stock or orders are fabricated.

insert into public.businesses (tenant_id,name,code,status,settings)
values (
  'MNTY-PLATFORM','متجر قدم السعد','MNTY-HOMEWARES-QADAM-ALSAAD','INACTIVE',
  jsonb_build_object(
    'brand','MantiqatiX','source','OFFICIAL_PLATFORM_SHOWCASE','showcase',true,
    'managed_by','SUPER_ADMIN','activity_code','HOMEWARES','category_code','HOMEWARES',
    'icon','🏠','headline','أدوات منزلية ومستلزمات المطبخ','catalog_public_enabled',true,
    'catalog_profile',jsonb_build_object(
      'bio','متجر قدم السعد للأدوات المنزلية ومستلزمات المطبخ وأطقم التقديم.',
      'category','أدوات منزلية ومستلزمات المطبخ','show_prices',true,
      'pricing_display','STARTING_PRICE','location_label','مصر'
    ),
    'display_name_ar','متجر قدم السعد','profile_complete',true
  )
)
on conflict (tenant_id,code) do update set
  name=excluded.name,
  settings=public.businesses.settings || excluded.settings,
  updated_at=now();

insert into public.user_memberships (id,user_id,tenant_id,business_id,role,permissions,status)
select 'MNTY-QADAM-ALSAAD-OWNER','f7914ac7-4b03-4456-afdd-e386f2ac6a5b',
       b.tenant_id,b.id,'OWNER','["*"]'::jsonb,'ACTIVE'
from public.businesses b
where b.tenant_id='MNTY-PLATFORM' and b.code='MNTY-HOMEWARES-QADAM-ALSAAD'
on conflict (id) do update set
  user_id=excluded.user_id,tenant_id=excluded.tenant_id,business_id=excluded.business_id,
  role='OWNER',permissions=excluded.permissions,status='ACTIVE';

update public.businesses set status='ACTIVE',updated_at=now()
where tenant_id='MNTY-PLATFORM' and code='MNTY-HOMEWARES-QADAM-ALSAAD';

insert into public.branches (id,tenant_id,business_id,name,code,status,settings)
select 'MNTY-HOMEWARES-QADAM-ALSAAD-MAIN',b.tenant_id,b.id,
       'متجر قدم السعد — الفرع الرئيسي','MNTY-HOMEWARES-QADAM-ALSAAD-MAIN','ACTIVE',
       '{"public_directory":true,"catalog_public_enabled":true}'::jsonb
from public.businesses b
where b.tenant_id='MNTY-PLATFORM' and b.code='MNTY-HOMEWARES-QADAM-ALSAAD'
on conflict (business_id,code) do update set
  name=excluded.name,status='ACTIVE',
  settings=coalesce(public.branches.settings,'{}'::jsonb)||excluded.settings,
  updated_at=now();

with products as (
  select * from (values
    ('QAS-001','ترمس نيش',249.00::numeric,'STARTING_PRICE','أدوات تقديم ومشروبات'),
    ('QAS-002','غلاي استيل 2 لتر',165.00::numeric,'STARTING_PRICE','أجهزة ومستلزمات المطبخ'),
    ('QAS-003','مج قهوة بالطبق',30.00::numeric,'FIXED','أكواب ومشروبات'),
    ('QAS-004','طقم كاس 6 ق مستورد',549.00::numeric,'STARTING_PRICE','أطقم كاسات'),
    ('QAS-005','طقم صواني كيك أشكال',149.00::numeric,'STARTING_PRICE','قوالب وصواني كيك'),
    ('QAS-006','طقم صواني خشب 2 في لوكس',null::numeric,'CONTACT_FOR_PRICE','صواني تقديم'),
    ('QAS-007','مج بورسلين يد قلب',55.00::numeric,'FIXED','أكواب ومشروبات'),
    ('QAS-008','طقم شوربة بالسلطانية بلانز مستورد',null::numeric,'CONTACT_FOR_PRICE','أطقم تقديم'),
    ('QAS-009','طقم ميلامين 38 قطعة شي إن',null::numeric,'CONTACT_FOR_PRICE','أطقم مائدة'),
    ('QAS-010','مقلاة كريب جرانيت مقاس 32 مستوردة',638.00::numeric,'STARTING_PRICE','أواني طهي'),
    ('QAS-011','مضرب نسكافيه مستورد',85.00::numeric,'STARTING_PRICE','أدوات مشروبات'),
    ('QAS-012','ولاعة يو إس بي شحن',50.00::numeric,'STARTING_PRICE','إكسسوارات المطبخ'),
    ('QAS-013','طقم توزيع سيليكون 7 قطعة',295.00::numeric,'STARTING_PRICE','أدوات مطبخ'),
    ('QAS-014','مقسمة أكريليك',245.00::numeric,'STARTING_PRICE','أدوات تقديم'),
    ('QAS-015','طقم صواني استيل ليزر 2 قطعة مرايا',575.00::numeric,'STARTING_PRICE','صواني تقديم')
  ) as p(legacy_ref,name_ar,price,price_mode,category)
), upserted as (
  insert into public.catalog_items
    (tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,description,status,tax_rate,metadata)
  select b.tenant_id,b.id,'MNTY-HOMEWARES-QADAM-ALSAAD-MAIN',p.legacy_ref,'PRODUCT',
    p.name_ar,
    'منتج من كتالوج متجر قدم السعد. السعر الظاهر من المصدر؛ يُرجى تأكيد السعر النهائي والتوفر مع المتجر.',
    'ACTIVE',0,
    jsonb_build_object('source','TAGERFLOW_CATALOG_SCREENSHOTS',
      'catalog_public',jsonb_build_object(
        'category',p.category,'unit','قطعة / طقم حسب المنتج','is_available',true,
        'track_stock',false,'show_price',p.price is not null,'price_mode',p.price_mode,
        'price_note',case when p.price_mode='STARTING_PRICE' then 'يبدأ من'
                         when p.price_mode='CONTACT_FOR_PRICE' then 'عند الاستفسار'
                         else null end,
        'image_source','screenshot_reference_pending'
      ))
  from public.businesses b cross join products p
  where b.tenant_id='MNTY-PLATFORM' and b.code='MNTY-HOMEWARES-QADAM-ALSAAD'
  on conflict (business_id,legacy_ref) where legacy_ref is not null do update set
    name_ar=excluded.name_ar,description=excluded.description,status='ACTIVE',
    metadata=coalesce(public.catalog_items.metadata,'{}'::jsonb)||excluded.metadata,
    updated_at=now()
  returning id,tenant_id,legacy_ref
)
insert into public.catalog_item_prices
  (tenant_id,catalog_item_id,branch_id,currency,unit_price,status)
select u.tenant_id,u.id,'MNTY-HOMEWARES-QADAM-ALSAAD-MAIN','EGP',p.price,'ACTIVE'
from upserted u join products p on p.legacy_ref=u.legacy_ref
where p.price is not null
and not exists (
  select 1 from public.catalog_item_prices cp
  where cp.catalog_item_id=u.id and cp.branch_id='MNTY-HOMEWARES-QADAM-ALSAAD-MAIN'
    and cp.status='ACTIVE' and cp.effective_to is null
);
