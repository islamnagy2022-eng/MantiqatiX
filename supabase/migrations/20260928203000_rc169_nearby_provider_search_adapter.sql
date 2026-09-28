create or replace function public.find_mnty_nearby_provider_businesses(
  p_lat double precision,
  p_lon double precision,
  p_radius_km double precision default 3
)
returns table (business_id uuid, distance_km double precision)
language sql
security definer
set search_path = public
as $fn$
  with points as (
    select p_lat lat, p_lon lon, greatest(0, least(coalesce(p_radius_km,3),10)) radius_km
  ),
  distances as (
    select b.business_id,
      6371.0 * 2.0 * asin(least(1.0, sqrt(
        power(sin(radians((b.latitude::double precision - p.lat)/2.0)),2)
        + cos(radians(p.lat))*cos(radians(b.latitude::double precision))
        * power(sin(radians((b.longitude::double precision - p.lon)/2.0)),2)
      ))) as distance_km
    from public.branches b
    join public.marketing_provider_profiles mp
      on mp.business_id = b.business_id and mp.status = 'ACTIVE'
    cross join points p
    where b.latitude is not null and b.longitude is not null and b.business_id is not null
  ),
  nearest as (
    select business_id, min(distance_km) distance_km from distances group by business_id
  )
  select n.business_id, round(n.distance_km::numeric,3)::double precision
  from nearest n cross join points p
  where p.radius_km >= 10 or n.distance_km <= p.radius_km
  order by n.distance_km asc
  limit 200;
$fn$;

revoke execute on function public.find_mnty_nearby_provider_businesses(double precision,double precision,double precision) from public;
grant execute on function public.find_mnty_nearby_provider_businesses(double precision,double precision,double precision) to anon, authenticated;
