
insert into public.business_categories(id,sector_id,code,name_ar,name_en,status)
values
 ('CAT-MEDICAL','SEC-MEDICAL','MEDICAL','مراكز طبية','Medical Centers','ACTIVE'),
 ('CAT-FREELANCER','SEC-FREELANCER','FREELANCER','المستقلون ومقدمو الخدمات','Freelancers & Service Providers','ACTIVE')
on conflict (id) do update
set sector_id=excluded.sector_id,
    code=excluded.code,
    name_ar=excluded.name_ar,
    name_en=excluded.name_en,
    status=excluded.status;
