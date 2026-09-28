-- RC211 — Ensure newly approved global cover ads enter the rotation
create or replace function public.get_mnty_targeted_advertisements(
  p_country_code varchar default 'EG',
  p_governorate_code varchar default null,
  p_center_code varchar default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_ad_space_id varchar default null,
  p_limit integer default 3
)
returns table(
  advertisement_id varchar,
  title varchar,
  creative_url text,
  target_url text,
  ad_space_id varchar,
  match_level varchar,
  distance_km double precision
)
language sql
security definer
set search_path = public
as $function$
with active_ads as (
  select a.id,a.title,a.creative_url,a.target_url,a.ad_space_id,a.created_at
  from public.advertisements a
  where a.status='ACTIVE' and a.approval_status='APPROVED'
    and (a.start_at is null or a.start_at<=now())
    and (a.end_at is null or a.end_at>=now())
    and (p_ad_space_id is null or a.ad_space_id=p_ad_space_id)
),
raw as (
  select a.id,a.title,a.creative_url,a.target_url,a.ad_space_id,
         g.level,g.code,g.latitude,g.longitude,a.created_at,
         case
           when g.level='CENTER' and p_center_code is not null and g.code=p_center_code then 1
           when g.level='GOVERNORATE' and p_governorate_code is not null and g.code=p_governorate_code then 2
           when g.level='COUNTRY' and g.code=coalesce(p_country_code,'EG') then 3
           when p_lat is not null and p_lon is not null and g.latitude is not null and g.longitude is not null then 4
           else 5
         end match_rank,
         case when p_lat is null or p_lon is null or g.latitude is null or g.longitude is null then null
           else 6371.0088*2*asin(sqrt(
             power(sin(radians(g.latitude-p_lat)/2),2)
             + cos(radians(p_lat))*cos(radians(g.latitude))
             * power(sin(radians(g.longitude-p_lon)/2),2)
           )) end km
  from active_ads a
  join public.advertisement_target_locations t on t.advertisement_id=a.id
  join public.platform_geo_areas g on g.id=t.geo_area_id
  where g.status='ACTIVE' and g.country_code=coalesce(p_country_code,'EG')
),
global_ads as (
  select ('GLOBAL-'||g.id::text)::varchar id,g.title,g.creative_url,g.target_url,g.ad_space_id,
         'COUNTRY'::varchar level,null::varchar code,null::double precision latitude,
         null::double precision longitude,g.created_at,6::integer match_rank,
         null::double precision km
  from public.platform_global_advertisements g
  where g.status='ACTIVE' and g.approval_status='APPROVED'
    and (g.start_at is null or g.start_at<=now())
    and (g.end_at is null or g.end_at>=now())
    and (p_ad_space_id is null or g.ad_space_id=p_ad_space_id)
),
combined as (
  select id,title,creative_url,target_url,ad_space_id,level,code,latitude,longitude,created_at,match_rank,km from raw
  union all
  select id,title,creative_url,target_url,ad_space_id,level,code,latitude,longitude,created_at,match_rank,km from global_ads
),
best_per_ad as (
  select *,row_number() over(partition by id order by match_rank,km nulls last,created_at desc nulls last) rn
  from combined
)
select b.id,b.title,b.creative_url,b.target_url,b.ad_space_id,
  case b.match_rank when 1 then 'CENTER' when 2 then 'GOVERNORATE'
       when 3 then 'COUNTRY' when 4 then 'NEAREST' else 'GLOBAL' end,
  b.km
from best_per_ad b
where b.rn=1
order by b.match_rank,b.km nulls last,b.created_at desc nulls last,b.id
limit greatest(1,least(coalesce(p_limit,3),50));
$function$;

revoke execute on function public.get_mnty_targeted_advertisements(varchar,varchar,varchar,double precision,double precision,varchar,integer) from public, anon, authenticated;
grant execute on function public.get_mnty_targeted_advertisements(varchar,varchar,varchar,double precision,double precision,varchar,integer) to anon, authenticated;