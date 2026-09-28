-- RC210 — Egypt governorate master baseline for MNTY geographic targeting
-- Source: CAPMAS governorate code convention (codes 1-4, 11-19, 21-29, 31-35).
-- The 2024 CAPMAS publications guide states the Administrative Units Directory
-- is the domestic source and that its latest edition at publication time was 2023.
-- This migration intentionally seeds governorates only; centers/Markaz remain open
-- until the current authoritative 2023 directory data is obtained.

insert into public.platform_geo_areas
  (country_code, level, code, parent_id, name_ar, name_en, status)
select
  'EG',
  'GOVERNORATE',
  v.code,
  c.id,
  v.name_ar,
  v.name_en,
  'ACTIVE'
from (values
  ('01','القاهرة','Cairo'),
  ('02','الإسكندرية','Alexandria'),
  ('03','بورسعيد','Port Said'),
  ('04','السويس','Suez'),
  ('11','دمياط','Damietta'),
  ('12','الدقهلية','Dakahlia'),
  ('13','الشرقية','Sharkia'),
  ('14','القليوبية','Qalyubia'),
  ('15','كفر الشيخ','Kafr El Sheikh'),
  ('16','الغربية','Gharbia'),
  ('17','المنوفية','Menoufia'),
  ('18','البحيرة','Beheira'),
  ('19','الإسماعيلية','Ismailia'),
  ('21','الجيزة','Giza'),
  ('22','بني سويف','Beni Suef'),
  ('23','الفيوم','Faiyum'),
  ('24','المنيا','Minya'),
  ('25','أسيوط','Assiut'),
  ('26','سوهاج','Sohag'),
  ('27','قنا','Qena'),
  ('28','أسوان','Aswan'),
  ('29','الأقصر','Luxor'),
  ('31','البحر الأحمر','Red Sea'),
  ('32','الوادي الجديد','New Valley'),
  ('33','مطروح','Matrouh'),
  ('34','شمال سيناء','North Sinai'),
  ('35','جنوب سيناء','South Sinai')
) as v(code,name_ar,name_en)
cross join lateral (
  select id from public.platform_geo_areas
  where country_code='EG' and level='COUNTRY' and code='EG'
  limit 1
) c
on conflict (country_code, level, code)
do update set
  parent_id = excluded.parent_id,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  status = excluded.status,
  updated_at = now();

do $$
declare
  eg_count integer;
  gov_count integer;
begin
  select count(*) into eg_count
  from public.platform_geo_areas
  where country_code='EG' and level='COUNTRY' and code='EG' and status='ACTIVE';

  select count(*) into gov_count
  from public.platform_geo_areas
  where country_code='EG' and level='GOVERNORATE' and status='ACTIVE';

  if eg_count <> 1 then
    raise exception 'RC210: Egypt country baseline missing or duplicated';
  end if;

  if gov_count <> 27 then
    raise exception 'RC210: expected 27 active Egypt governorates, found %', gov_count;
  end if;
end $$;