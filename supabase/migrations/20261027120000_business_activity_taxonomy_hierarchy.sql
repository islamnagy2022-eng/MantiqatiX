-- MantiqatiX activity taxonomy hierarchy (additive; not applied to production).
-- Parent records are sectors/groups; child records are selectable business activities/specialties.
begin;

create table if not exists public.business_activity_types (
  id text primary key,
  sector_id varchar not null references public.business_sectors(id) on update cascade on delete restrict,
  parent_id text null references public.business_activity_types(id) on update cascade on delete restrict,
  legacy_category_id varchar null references public.business_categories(id) on update cascade on delete set null,
  code varchar not null unique,
  name_ar varchar not null,
  name_en varchar not null default '',
  node_type varchar not null check (node_type in ('SECTOR_GROUP','ACTIVITY','SPECIALTY')),
  status varchar not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','ARCHIVED')),
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_activity_types_not_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists idx_business_activity_types_sector_status_order
  on public.business_activity_types(sector_id, status, sort_order, name_ar);
create index if not exists idx_business_activity_types_parent
  on public.business_activity_types(parent_id, status, sort_order);
create index if not exists idx_business_activity_types_legacy_category
  on public.business_activity_types(legacy_category_id);

alter table public.business_activity_types enable row level security;
alter table public.business_activity_types force row level security;
revoke all on public.business_activity_types from anon, authenticated;
grant all on public.business_activity_types to service_role;

-- Make the seed replayable from a schema-only production checkpoint where
-- earlier directory seed data may not have been restored. Only insert missing
-- canonical sector/category rows; never overwrite existing names or assignments.
insert into public.business_sectors(id,code,name_ar,name_en,status)
values
('SEC-ACCOUNTING','ACCOUNTING','محاسب منطقتي','Accountant MantiqatiX','ACTIVE'),
('SEC-AUTO','AUTO','سيارات منطقتي','Auto MantiqatiX','ACTIVE'),
('SEC-COMPANIES','COMPANIES','شركة منطقتي','Company MantiqatiX','ACTIVE'),
('SEC-DENTAL','DENTAL','أسنان منطقتي','Dental MantiqatiX','ACTIVE'),
('SEC-EDUCATION','EDUCATION','مدرسة منطقتي','School MantiqatiX','ACTIVE'),
('SEC-ERP','ERP','برمجيات منطقتي','Software MantiqatiX','ACTIVE'),
('SEC-FASHION','FASHION','أزياء منطقتي','Fashion MantiqatiX','ACTIVE'),
('SEC-FOOD','FOOD','مطعم منطقتي','Restaurant MantiqatiX','ACTIVE'),
('SEC-FREELANCER','FREELANCER','المستقلون ومقدمو الخدمات','Freelancers & Service Providers','ACTIVE'),
('SEC-GROCERY','GROCERY','سوبر ماركت منطقتي','Supermarket MantiqatiX','ACTIVE'),
('SEC-HEALTH','HEALTH','دكتور منطقتي','Doctor MantiqatiX','ACTIVE'),
('SEC-HOSPITAL','HOSPITAL','مستشفى منطقتي','Hospital MantiqatiX','ACTIVE'),
('SEC-JOBS','JOBS','وظائف منطقتي','Jobs MantiqatiX','ACTIVE'),
('SEC-LABS','LABS','معمل منطقتي','Lab MantiqatiX','ACTIVE'),
('SEC-LEGAL','LEGAL','محامي منطقتي','Lawyer MantiqatiX','ACTIVE'),
('SEC-MAINTENANCE','MAINTENANCE','صيانة منطقتي','Maintenance MantiqatiX','ACTIVE'),
('SEC-MANTIGO','MANTIGO','نقل منطقتي','Transport MantiqatiX','ACTIVE'),
('SEC-MARKETING','MARKETING','تسويق منطقتي','Marketing MantiqatiX','ACTIVE'),
('SEC-MATRIMONY','MATRIMONY','زواج منطقتي','Matrimony MantiqatiX','ACTIVE'),
('SEC-MEDICAL','MEDICAL','مراكز طبية','Medical Centers','ACTIVE'),
('SEC-PHARMACY','PHARMACY','صيدلية منطقتي','Pharmacy MantiqatiX','ACTIVE'),
('SEC-RADIOLOGY','RADIOLOGY','أشعة منطقتي','Radiology MantiqatiX','ACTIVE'),
('SEC-REAL_ESTATE','REAL_ESTATE','عقارات منطقتي','Real Estate MantiqatiX','ACTIVE'),
('SEC-SPORTS','SPORTS','رياضة منطقتي','Sports MantiqatiX','ACTIVE'),
('SEC-TRIPS','TRIPS','سفر منطقتي','Travel MantiqatiX','ACTIVE'),
('SEC-USED_ITEMS','USED_ITEMS','مستعمل منطقتي','Used Items MantiqatiX','ACTIVE'),
('SEC-VETERINARY','VETERINARY','بيطري منطقتي','Veterinary MantiqatiX','ACTIVE')
on conflict (id) do nothing;

insert into public.business_categories(id,sector_id,code,name_ar,name_en,status)
values
('CAT-ACCOUNTING','SEC-ACCOUNTING','ACCOUNTING','المحاسبة والأعمال','Accounting & Business','ACTIVE'),
('CAT-AUTO','SEC-AUTO','AUTO','سيارات منطقتي','Auto MantiqatiX','ACTIVE'),
('CAT-COMPANIES','SEC-COMPANIES','COMPANIES','شركة منطقتي','Company MantiqatiX','ACTIVE'),
('CAT-DENTAL','SEC-DENTAL','DENTAL','أسنان منطقتي','Dental MantiqatiX','ACTIVE'),
('CAT-EDUCATION','SEC-EDUCATION','EDUCATION','مدرسة منطقتي','School MantiqatiX','ACTIVE'),
('CAT-ERP','SEC-ERP','ERP','برمجيات منطقتي','Software MantiqatiX','ACTIVE'),
('CAT-FASHION','SEC-FASHION','FASHION','أزياء منطقتي','Fashion MantiqatiX','ACTIVE'),
('CAT-FOOD','SEC-FOOD','FOOD','مطعم منطقتي','Restaurant MantiqatiX','ACTIVE'),
('CAT-FREELANCER','SEC-FREELANCER','FREELANCER','المستقلون ومقدمو الخدمات','Freelancers & Services','ACTIVE'),
('CAT-GROCERY','SEC-GROCERY','GROCERY','سوبر ماركت منطقتي','Supermarket MantiqatiX','ACTIVE'),
('CAT-HEALTH','SEC-HEALTH','HEALTH','دكتور منطقتي','Doctor MantiqatiX','ACTIVE'),
('CAT-HOSPITAL','SEC-HOSPITAL','HOSPITAL','مستشفى منطقتي','Hospital MantiqatiX','ACTIVE'),
('CAT-JOBS','SEC-JOBS','JOBS','وظائف منطقتي','Jobs MantiqatiX','ACTIVE'),
('CAT-LABS','SEC-LABS','LABS','معمل منطقتي','Lab MantiqatiX','ACTIVE'),
('CAT-LEGAL','SEC-LEGAL','LEGAL','محامي منطقتي','Lawyer MantiqatiX','ACTIVE'),
('CAT-MAINTENANCE','SEC-MAINTENANCE','MAINTENANCE','صيانة منطقتي','Maintenance MantiqatiX','ACTIVE'),
('CAT-MANTIGO','SEC-MANTIGO','MANTIGO','نقل منطقتي','Transport MantiqatiX','ACTIVE'),
('CAT-MARKETING','SEC-MARKETING','MARKETING','تسويق منطقتي','Marketing MantiqatiX','ACTIVE'),
('CAT-MATRIMONY','SEC-MATRIMONY','MATRIMONY','زواج منطقتي','Matrimony MantiqatiX','ACTIVE'),
('CAT-MEDICAL','SEC-MEDICAL','MEDICAL','مراكز طبية','Medical Centers','ACTIVE'),
('CAT-PHARMACY','SEC-PHARMACY','PHARMACY','صيدلية منطقتي','Pharmacy MantiqatiX','ACTIVE'),
('CAT-RADIOLOGY','SEC-RADIOLOGY','RADIOLOGY','أشعة منطقتي','Radiology MantiqatiX','ACTIVE'),
('CAT-REAL_ESTATE','SEC-REAL_ESTATE','REAL_ESTATE','عقارات منطقتي','Real Estate MantiqatiX','ACTIVE'),
('CAT-SPORTS','SEC-SPORTS','SPORTS','رياضة منطقتي','Sports MantiqatiX','ACTIVE'),
('CAT-TRIPS','SEC-TRIPS','TRIPS','سفر منطقتي','Travel MantiqatiX','ACTIVE'),
('CAT-USED_ITEMS','SEC-USED_ITEMS','USED_ITEMS','مستعمل منطقتي','Used Items MantiqatiX','ACTIVE'),
('CAT-VETERINARY','SEC-VETERINARY','VETERINARY','بيطري منطقتي','Veterinary MantiqatiX','ACTIVE')
on conflict (id) do nothing;

-- Stable top-level group per existing sector. Existing business_categories and
-- sector identifiers are preserved; no business is reassigned by this seed.
insert into public.business_activity_types
(id, sector_id, legacy_category_id, code, name_ar, name_en, node_type, sort_order)
values
('group-accounting','SEC-ACCOUNTING','CAT-ACCOUNTING','GROUP_ACCOUNTING','المحاسبة والأعمال','Accounting & Business','SECTOR_GROUP',10),
('group-auto','SEC-AUTO','CAT-AUTO','GROUP_AUTO','السيارات والمركبات','Automotive','SECTOR_GROUP',20),
('group-companies','SEC-COMPANIES','CAT-COMPANIES','GROUP_COMPANIES','الشركات والخدمات المؤسسية','Companies & Corporate Services','SECTOR_GROUP',30),
('group-dental','SEC-DENTAL','CAT-DENTAL','GROUP_DENTAL','طب الأسنان','Dental Care','SECTOR_GROUP',40),
('group-education','SEC-EDUCATION','CAT-EDUCATION','GROUP_EDUCATION','التعليم والتدريب','Education & Training','SECTOR_GROUP',50),
('group-erp','SEC-ERP','CAT-ERP','GROUP_ERP','البرمجيات والخدمات التقنية','Software & Technology','SECTOR_GROUP',60),
('group-fashion','SEC-FASHION','CAT-FASHION','GROUP_FASHION','الأزياء والخياطة','Fashion & Tailoring','SECTOR_GROUP',70),
('group-food','SEC-FOOD','CAT-FOOD','GROUP_FOOD','الطعام والمطاعم','Food & Restaurants','SECTOR_GROUP',80),
('group-freelancer','SEC-FREELANCER','CAT-FREELANCER','GROUP_FREELANCER','المهن والخدمات المستقلة','Freelancers & Services','SECTOR_GROUP',90),
('group-grocery','SEC-GROCERY','CAT-GROCERY','GROUP_GROCERY','البقالة والتجزئة','Grocery & Retail','SECTOR_GROUP',100),
('group-health','SEC-HEALTH','CAT-HEALTH','GROUP_HEALTH','الأطباء والتخصصات الطبية','Doctors & Medical Specialties','SECTOR_GROUP',110),
('group-hospital','SEC-HOSPITAL','CAT-HOSPITAL','GROUP_HOSPITAL','المستشفيات والرعاية الطبية','Hospitals & Medical Care','SECTOR_GROUP',120),
('group-jobs','SEC-JOBS','CAT-JOBS','GROUP_JOBS','الوظائف والتوظيف','Jobs & Recruitment','SECTOR_GROUP',130),
('group-labs','SEC-LABS','CAT-LABS','GROUP_LABS','المعامل والتحاليل','Laboratories','SECTOR_GROUP',140),
('group-legal','SEC-LEGAL','CAT-LEGAL','GROUP_LEGAL','المحاماة والخدمات القانونية','Legal Services','SECTOR_GROUP',150),
('group-maintenance','SEC-MAINTENANCE','CAT-MAINTENANCE','GROUP_MAINTENANCE','الصيانة والحرف','Maintenance & Trades','SECTOR_GROUP',160),
('group-mantigo','SEC-MANTIGO','CAT-MANTIGO','GROUP_MANTIGO','النقل والتوصيل','Transport & Delivery','SECTOR_GROUP',170),
('group-marketing','SEC-MARKETING','CAT-MARKETING','GROUP_MARKETING','التسويق والإعلان','Marketing & Advertising','SECTOR_GROUP',180),
('group-matrimony','SEC-MATRIMONY','CAT-MATRIMONY','GROUP_MATRIMONY','الزواج والتوفيق','Matrimony','SECTOR_GROUP',190),
('group-medical','SEC-MEDICAL','CAT-MEDICAL','GROUP_MEDICAL','المراكز الطبية','Medical Centers','SECTOR_GROUP',200),
('group-pharmacy','SEC-PHARMACY','CAT-PHARMACY','GROUP_PHARMACY','الصيدليات','Pharmacies','SECTOR_GROUP',210),
('group-radiology','SEC-RADIOLOGY','CAT-RADIOLOGY','GROUP_RADIOLOGY','الأشعة والتصوير الطبي','Radiology','SECTOR_GROUP',220),
('group-real-estate','SEC-REAL_ESTATE','CAT-REAL_ESTATE','GROUP_REAL_ESTATE','العقارات','Real Estate','SECTOR_GROUP',230),
('group-sports','SEC-SPORTS','CAT-SPORTS','GROUP_SPORTS','الرياضة واللياقة','Sports & Fitness','SECTOR_GROUP',240),
('group-trips','SEC-TRIPS','CAT-TRIPS','GROUP_TRIPS','السياحة والرحلات','Travel & Trips','SECTOR_GROUP',250),
('group-used-items','SEC-USED_ITEMS','CAT-USED_ITEMS','GROUP_USED_ITEMS','المستعمل والإعلانات المبوبة','Used Items & Classifieds','SECTOR_GROUP',260),
('group-veterinary','SEC-VETERINARY','CAT-VETERINARY','GROUP_VETERINARY','الطب البيطري والحيوانات','Veterinary & Animals','SECTOR_GROUP',270)
on conflict (id) do nothing;

-- Initial selectable activity and specialty registry. Stable IDs allow future
-- label edits without changing references. “فني تبريد” is the canonical label.
insert into public.business_activity_types
(id, sector_id, parent_id, legacy_category_id, code, name_ar, name_en, node_type, sort_order)
values
('activity-doctor','SEC-HEALTH','group-health','CAT-HEALTH','DOCTOR','طبيب','Doctor','ACTIVITY',10),
('specialty-doctor-internal','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_INTERNAL_MEDICINE','طبيب باطنة','Internal Medicine Doctor','SPECIALTY',10),
('specialty-doctor-pediatrics','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_PEDIATRICS','طبيب أطفال','Pediatrician','SPECIALTY',20),
('specialty-doctor-cardiology','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_CARDIOLOGY','طبيب قلب','Cardiologist','SPECIALTY',30),
('specialty-doctor-dermatology','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_DERMATOLOGY','طبيب جلدية','Dermatologist','SPECIALTY',40),
('specialty-doctor-orthopedics','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_ORTHOPEDICS','طبيب عظام','Orthopedic Doctor','SPECIALTY',50),
('specialty-doctor-obgyn','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_OBGYN','طبيب نساء وتوليد','Obstetrician & Gynecologist','SPECIALTY',60),
('specialty-doctor-urology','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_UROLOGY','طبيب مسالك بولية','Urologist','SPECIALTY',70),
('specialty-doctor-ent','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_ENT','طبيب أنف وأذن وحنجرة','ENT Doctor','SPECIALTY',80),
('specialty-doctor-eye','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_OPHTHALMOLOGY','طبيب عيون','Ophthalmologist','SPECIALTY',90),
('specialty-doctor-neuro','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_NEUROLOGY','طبيب مخ وأعصاب','Neurologist','SPECIALTY',100),
('specialty-doctor-psychiatry','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_PSYCHIATRY','طبيب نفسي','Psychiatrist','SPECIALTY',110),
('specialty-doctor-surgery','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_SURGERY','طبيب جراحة عامة','General Surgeon','SPECIALTY',120),
('specialty-doctor-oncology','SEC-HEALTH','activity-doctor','CAT-HEALTH','DOCTOR_ONCOLOGY','طبيب أورام','Oncologist','SPECIALTY',130),
('activity-dental-doctor','SEC-DENTAL','group-dental','CAT-DENTAL','DENTAL_DOCTOR','طبيب أسنان','Dentist','ACTIVITY',10),
('specialty-dental-children','SEC-DENTAL','activity-dental-doctor','CAT-DENTAL','DENTAL_PEDIATRIC','طبيب أسنان أطفال','Pediatric Dentist','SPECIALTY',10),
('specialty-dental-orthodontics','SEC-DENTAL','activity-dental-doctor','CAT-DENTAL','DENTAL_ORTHODONTICS','طبيب تقويم أسنان','Orthodontist','SPECIALTY',20),
('activity-medical-center','SEC-MEDICAL','group-medical','CAT-MEDICAL','MEDICAL_CENTER','مركز طبي','Medical Center','ACTIVITY',10),
('activity-hospital','SEC-HOSPITAL','group-hospital','CAT-HOSPITAL','HOSPITAL','مستشفى','Hospital','ACTIVITY',10),
('activity-lab','SEC-LABS','group-labs','CAT-LABS','MEDICAL_LAB','معمل تحاليل طبية','Medical Laboratory','ACTIVITY',10),
('activity-radiology','SEC-RADIOLOGY','group-radiology','CAT-RADIOLOGY','RADIOLOGY_CENTER','مركز أشعة','Radiology Center','ACTIVITY',10),
('activity-pharmacy','SEC-PHARMACY','group-pharmacy','CAT-PHARMACY','PHARMACY','صيدلية','Pharmacy','ACTIVITY',10),
('activity-restaurant','SEC-FOOD','group-food','CAT-FOOD','RESTAURANT','مطعم','Restaurant','ACTIVITY',10),
('specialty-food-grill','SEC-FOOD','activity-restaurant','CAT-FOOD','RESTAURANT_GRILL','مطعم مشويات','Grill Restaurant','SPECIALTY',10),
('specialty-food-seafood','SEC-FOOD','activity-restaurant','CAT-FOOD','RESTAURANT_SEAFOOD','مطعم مأكولات بحرية','Seafood Restaurant','SPECIALTY',20),
('specialty-food-fast','SEC-FOOD','activity-restaurant','CAT-FOOD','RESTAURANT_FAST_FOOD','مطعم وجبات سريعة','Fast Food Restaurant','SPECIALTY',30),
('specialty-food-pizza','SEC-FOOD','activity-restaurant','CAT-FOOD','RESTAURANT_PIZZA','مطعم بيتزا','Pizza Restaurant','SPECIALTY',40),
('specialty-food-burger','SEC-FOOD','activity-restaurant','CAT-FOOD','RESTAURANT_BURGER','مطعم برجر','Burger Restaurant','SPECIALTY',50),
('activity-cafe','SEC-FOOD','group-food','CAT-FOOD','CAFE','كافيه','Cafe','ACTIVITY',20),
('activity-bakery','SEC-FOOD','group-food','CAT-FOOD','BAKERY','مخبز','Bakery','ACTIVITY',30),
('activity-grocery','SEC-GROCERY','group-grocery','CAT-GROCERY','GROCERY_STORE','بقالة','Grocery Store','ACTIVITY',10),
('activity-supermarket','SEC-GROCERY','group-grocery','CAT-GROCERY','SUPERMARKET','سوبر ماركت','Supermarket','ACTIVITY',20),
('activity-clothing','SEC-FASHION','group-fashion','CAT-FASHION','CLOTHING_STORE','محل ملابس','Clothing Store','ACTIVITY',10),
('specialty-clothing-men','SEC-FASHION','activity-clothing','CAT-FASHION','CLOTHING_MEN','محل ملابس رجالي','Menswear Store','SPECIALTY',10),
('specialty-clothing-women','SEC-FASHION','activity-clothing','CAT-FASHION','CLOTHING_WOMEN','محل ملابس حريمي','Womenswear Store','SPECIALTY',20),
('activity-plumber','SEC-MAINTENANCE','group-maintenance','CAT-MAINTENANCE','PLUMBER','سباك','Plumber','ACTIVITY',10),
('activity-electrician','SEC-MAINTENANCE','group-maintenance','CAT-MAINTENANCE','ELECTRICIAN','كهربائي','Electrician','ACTIVITY',20),
('activity-carpenter','SEC-MAINTENANCE','group-maintenance','CAT-MAINTENANCE','CARPENTER','نجار موبيليا','Furniture Carpenter','ACTIVITY',30),
('activity-blacksmith','SEC-MAINTENANCE','group-maintenance','CAT-MAINTENANCE','BLACKSMITH','حداد','Blacksmith','ACTIVITY',40),
('activity-refrigeration-technician','SEC-MAINTENANCE','group-maintenance','CAT-MAINTENANCE','REFRIGERATION_TECHNICIAN','فني تبريد','Refrigeration Technician','ACTIVITY',50),
('specialty-refrigerator-repair','SEC-MAINTENANCE','activity-refrigeration-technician','CAT-MAINTENANCE','REFRIGERATOR_REPAIR','صيانة ثلاجات','Refrigerator Repair','SPECIALTY',10),
('specialty-commercial-refrigeration','SEC-MAINTENANCE','activity-refrigeration-technician','CAT-MAINTENANCE','COMMERCIAL_REFRIGERATION','تبريد تجاري','Commercial Refrigeration','SPECIALTY',20),
('specialty-cold-rooms','SEC-MAINTENANCE','activity-refrigeration-technician','CAT-MAINTENANCE','COLD_ROOMS','تركيب وصيانة غرف تبريد','Cold Room Installation & Maintenance','SPECIALTY',30),
('activity-cleaning','SEC-FREELANCER','group-freelancer','CAT-FREELANCER','CLEANING_SERVICE','خدمات تنظيف','Cleaning Service','ACTIVITY',10),
('activity-car-repair','SEC-AUTO','group-auto','CAT-AUTO','CAR_REPAIR','مركز صيانة سيارات','Auto Repair Center','ACTIVITY',10),
('activity-car-parts','SEC-AUTO','group-auto','CAT-AUTO','AUTO_PARTS','محل قطع غيار سيارات','Auto Parts Store','ACTIVITY',20),
('activity-lawyer','SEC-LEGAL','group-legal','CAT-LEGAL','LAWYER','محامي','Lawyer','ACTIVITY',10),
('activity-law-firm','SEC-LEGAL','group-legal','CAT-LEGAL','LAW_FIRM','مكتب محاماة','Law Firm','ACTIVITY',20),
('activity-accountant','SEC-ACCOUNTING','group-accounting','CAT-ACCOUNTING','ACCOUNTANT','محاسب','Accountant','ACTIVITY',10),
('activity-marketing-agency','SEC-MARKETING','group-marketing','CAT-MARKETING','MARKETING_AGENCY','شركة تسويق إلكتروني','Digital Marketing Agency','ACTIVITY',10),
('activity-graphic-designer','SEC-MARKETING','group-marketing','CAT-MARKETING','GRAPHIC_DESIGNER','مصمم جرافيك','Graphic Designer','ACTIVITY',20),
('activity-school','SEC-EDUCATION','group-education','CAT-EDUCATION','SCHOOL','مدرسة','School','ACTIVITY',10),
('activity-private-tutor','SEC-EDUCATION','group-education','CAT-EDUCATION','PRIVATE_TUTOR','مدرس خصوصي','Private Tutor','ACTIVITY',20),
('activity-real-estate-broker','SEC-REAL_ESTATE','group-real-estate','CAT-REAL_ESTATE','REAL_ESTATE_BROKER','وسيط عقاري','Real Estate Broker','ACTIVITY',10),
('activity-gym','SEC-SPORTS','group-sports','CAT-SPORTS','GYM','صالة ألعاب رياضية','Gym','ACTIVITY',10),
('activity-travel-agency','SEC-TRIPS','group-trips','CAT-TRIPS','TRAVEL_AGENCY','شركة سياحة وسفر','Travel Agency','ACTIVITY',10),
('activity-delivery','SEC-MANTIGO','group-mantigo','CAT-MANTIGO','DELIVERY_SERVICE','خدمة توصيل','Delivery Service','ACTIVITY',10),
('activity-job-agency','SEC-JOBS','group-jobs','CAT-JOBS','RECRUITMENT_AGENCY','شركة توظيف','Recruitment Agency','ACTIVITY',10),
('activity-vet','SEC-VETERINARY','group-veterinary','CAT-VETERINARY','VETERINARY_CLINIC','عيادة بيطرية','Veterinary Clinic','ACTIVITY',10),
('activity-used-items','SEC-USED_ITEMS','group-used-items','CAT-USED_ITEMS','USED_ITEMS_STORE','بيع وشراء المستعمل','Used Items Resale','ACTIVITY',10),
('activity-software','SEC-ERP','group-erp','CAT-ERP','SOFTWARE_DEVELOPMENT','تطوير برمجيات','Software Development','ACTIVITY',10),
('activity-company','SEC-COMPANIES','group-companies','CAT-COMPANIES','COMPANY_SERVICES','خدمات الشركات','Corporate Services','ACTIVITY',10),
('activity-wedding','SEC-MATRIMONY','group-matrimony','CAT-MATRIMONY','MATRIMONY_SERVICE','خدمات الزواج والتوفيق','Matrimony Service','ACTIVITY',10)
on conflict (id) do nothing;

commit;
