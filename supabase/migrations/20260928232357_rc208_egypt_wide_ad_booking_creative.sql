-- RC208: Egypt-wide official ad booking creative
insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status)
select
 'احجز مساحة إعلانية — كل أنحاء مصر',
 'https://islamnagy2022-eng.github.io/MantiqatiX/assets/mnty-ad-space-booking-banner.svg',
 'https://islamnagy2022-eng.github.io/MantiqatiX/',
 'ACTIVE','APPROVED'
where not exists (
 select 1 from public.platform_global_advertisements
 where title='احجز مساحة إعلانية — كل أنحاء مصر'
);
