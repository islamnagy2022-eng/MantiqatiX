alter table public.public_directory_listings
  add column if not exists functional_group_id text,
  add column if not exists taxonomy_category_id text,
  add column if not exists taxonomy_specialty text;

update public.public_directory_listings
set functional_group_id = coalesce(nullif(functional_group_id, ''), 'medical_health'),
    taxonomy_category_id = coalesce(nullif(taxonomy_category_id, ''), 'cat_medical_health_doctor');

update public.public_directory_listings
set taxonomy_category_id = case
  when specialty ilike '%أسنان%' or specialty ilike '%اسنان%' then 'cat_medical_health_dentist'
  when specialty ilike '%علاج طبيعي%' or specialty ilike '%تأهيل%' then 'cat_medical_health_physiotherapist'
  when specialty ilike '%أشعة%' or specialty ilike '%اشعة%' then 'cat_medical_health_radiology_specialist'
  else 'cat_medical_health_doctor'
end
where functional_group_id = 'medical_health';

update public.public_directory_listings
set taxonomy_specialty = case
  when specialty ilike '%عيون%' or specialty ilike '%رمد%' then 'طبيب عيون'
  when specialty ilike '%قلب%' then 'طبيب قلب'
  when specialty ilike '%أطفال%' or specialty ilike '%اطفال%' then 'طبيب أطفال'
  when specialty ilike '%باطنة%' or specialty ilike '%باطن%' then 'طبيب باطنة'
  when specialty ilike '%عظام%' then 'طبيب عظام'
  when specialty ilike '%جلد%' then 'طبيب جلدية'
  when specialty ilike '%مخ وأعصاب%' or specialty ilike '%أعصاب%' or specialty ilike '%اعصاب%' then 'طبيب مخ وأعصاب'
  when specialty ilike '%نفسي%' then 'طبيب نفسي'
  when specialty ilike '%أنف وأذن%' or specialty ilike '%حنجرة%' then 'طبيب أنف وأذن وحنجرة'
  when specialty ilike '%نساء وتوليد%' then 'طبيب نساء وتوليد'
  when specialty ilike '%مسالك%' then 'طبيب مسالك بولية'
  when specialty ilike '%صدر%' or specialty ilike '%حساسية ومناعة%' then 'طبيب صدر'
  when specialty ilike '%هضمي%' then 'طبيب جهاز هضمي'
  when specialty ilike '%كلى%' then 'طبيب كلى'
  when specialty ilike '%أورام%' or specialty ilike '%اورام%' then 'طبيب أورام'
  when specialty ilike '%جراحة تجميل%' or specialty ilike '%تجميل%' then 'طبيب جراحة تجميل'
  when specialty ilike '%جراحة%' then 'طبيب جراحة عامة'
  when specialty ilike '%أسنان%' or specialty ilike '%اسنان%' then 'أسنان عام'
  when specialty ilike '%أشعة%' or specialty ilike '%اشعة%' then 'أشعة تشخيصية'
  when specialty ilike '%علاج طبيعي%' then 'عظام'
  else null
end
where nullif(coalesce(taxonomy_specialty, ''), '') is null;

alter table public.public_directory_listings
  alter column functional_group_id set default 'medical_health',
  alter column functional_group_id set not null,
  alter column taxonomy_category_id set not null;
alter table public.public_directory_listings
  drop constraint if exists public_directory_listings_functional_group_id_check;
alter table public.public_directory_listings
  add constraint public_directory_listings_functional_group_id_check
  check (functional_group_id in ('medical_health','food_grocery','fashion_beauty','home_maintenance','construction_decor','auto_transport','real_estate','education_training','technology_communications','professional_services','marketing_media','trade_ecommerce','agriculture_animals','sports_fitness','tourism_events','finance_insurance','industry_workshops','public_community'));
create index if not exists public_directory_listings_taxonomy_group_idx
  on public.public_directory_listings (functional_group_id, listing_status, district);
create index if not exists public_directory_listings_taxonomy_category_idx
  on public.public_directory_listings (taxonomy_category_id, taxonomy_specialty, listing_status);
