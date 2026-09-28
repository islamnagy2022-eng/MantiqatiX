-- RC212 — nearest provider fallback beyond selected radius
create or replace function public.find_mnty_nearest_provider_businesses(
  p_lat double precision,
  p_lon double precision,
  p_limit integer default 12
)
returns table(business_id uuid, distance_km double precision)
language sql
security definer
set search_path = public
as $function$
with points as (
  select p_lat lat, p_lon lon
),
distances as (
  select b.business_id,
    6371.0088 * 2.0 * asin(least(1.0, sqrt(
      power(sin(radians((b.latitude::double precision - p.lat)/2.0)),2)
      + cos(radians(p.lat))*cos(radians(b.latitude::double precision))
      * power(sin(radians((b.longitude::double precision - p.lon)/2.0)),2)
    ))) as distance_km
  from public.branches b
  join public.marketing_provider_profiles mp
    on mp.business_id=b.business_id and mp.status='ACTIVE'
  cross join points p
  where b.latitude is not null
    and b.longitude is not null
    and b.business_id is not null
),
nearest as (
  select business_id,min(distance_km) distance_km
  from distances
  group by business_id
)
select n.business_id,
       round(n.distance_km::numeric,3)::double precision
from nearest n
order by n.distance_km asc,n.business_id
limit greatest(1,least(coalesce(p_limit,12),50));
$function$;

revoke execute on function public.find_mnty_nearest_provider_businesses(double precision,double precision,integer) from public;
grant execute on function public.find_mnty_nearest_provider_businesses(double precision,double precision,integer) to anon, authenticated;