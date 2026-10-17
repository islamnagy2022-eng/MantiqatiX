create or replace function public.get_mnty_targeted_advertisements(
  p_country_code varchar default 'EG',
  p_governorate_code varchar default null,
  p_center_code varchar default null,
  p_lat double precision default null,
  p_lon double precision default null,
  p_ad_space_id varchar default null,
  p_limit integer default 10
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
as $$
with active_ads as (
  select a.id, a.title, a.creative_url, a.target_url, a.ad_space_id
  from public.advertisements a
  where a.status = 'ACTIVE'
    and a.approval_status = 'APPROVED'
    and (a.start_at is null or a.start_at <= now())
    and (a.end_at is null or a.end_at >= now())
    and (p_ad_space_id is null or a.ad_space_id = p_ad_space_id)
),
raw as (
  select
    a.id, a.title, a.creative_url, a.target_url, a.ad_space_id,
    g.level, g.code, g.latitude, g.longitude,
    case
      when g.level='CENTER' and p_center_code is not null and g.code=p_center_code then 1
      when g.level='GOVERNORATE' and p_governorate_code is not null and g.code=p_governorate_code then 2
      when g.level='COUNTRY' and g.code=coalesce(p_country_code,'EG') then 3
      when p_lat is not null and p_lon is not null and g.latitude is not null and g.longitude is not null then 4
      else 5
    end as match_rank
  from active_ads a
  join public.advertisement_target_locations t on t.advertisement_id=a.id
  join public.platform_geo_areas g on g.id=t.geo_area_id
  where g.status='ACTIVE'
    and g.country_code=coalesce(p_country_code,'EG')
),
dist as (
  select r.*,
    case
      when p_lat is null or p_lon is null or r.latitude is null or r.longitude is null then null
      else 6371.0088 * 2 * asin(
        sqrt(
          power(sin(radians(r.latitude-p_lat)/2),2) +
          cos(radians(p_lat))*cos(radians(r.latitude))*power(sin(radians(r.longitude-p_lon)/2),2)
        )
      )
    end as km
  from raw r
),
best_per_ad as (
  select *,
    row_number() over(partition by id order by match_rank, km nulls last) as rn
  from dist
),
chosen_rank as (
  select min(match_rank) as rank from best_per_ad where rn=1
)
select
  b.id as advertisement_id,
  b.title,
  b.creative_url,
  b.target_url,
  b.ad_space_id,
  case b.match_rank when 1 then 'CENTER' when 2 then 'GOVERNORATE' when 3 then 'COUNTRY' else 'NEAREST' end as match_level,
  b.km as distance_km
from best_per_ad b
cross join chosen_rank c
where b.rn=1 and b.match_rank=c.rank
order by b.km nulls last, b.id
limit greatest(1, least(coalesce(p_limit,10),50));
$$;