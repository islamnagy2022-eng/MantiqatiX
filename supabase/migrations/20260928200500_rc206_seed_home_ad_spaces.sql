insert into public.ad_spaces(id,code,name,placement,status) values
('HOME_SPONSORED','HOME_SPONSORED','إعلانات ممولة - الصفحة الرئيسية','HOME_SPONSORED','ACTIVE'),
('HOME_HERO','HOME_HERO','الإعلان الرئيسي - الصفحة الرئيسية','HOME_HERO','ACTIVE')
on conflict (id) do update set name=excluded.name,placement=excluded.placement,status='ACTIVE';
