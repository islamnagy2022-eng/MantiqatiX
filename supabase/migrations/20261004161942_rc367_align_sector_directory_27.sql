-- RC367: align the database sector directory with the 27-sector public contract.
-- This adds only missing canonical sector rows; no showcase businesses, memberships,
-- permissions, orders, payments, or financial records are created.
insert into public.business_sectors(id,code,name_ar,name_en,status)
values
  ('SEC-MEDICAL','MEDICAL','مراكز طبية','Medical Centers','ACTIVE'),
  ('SEC-FREELANCER','FREELANCER','المستقلون ومقدمو الخدمات','Freelancers & Service Providers','ACTIVE')
on conflict (id) do update
set code=excluded.code,
    name_ar=excluded.name_ar,
    name_en=excluded.name_en,
    status=excluded.status;