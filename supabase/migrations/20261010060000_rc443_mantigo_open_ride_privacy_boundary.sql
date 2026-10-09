-- RC443: protect open-ride location data behind an active, verified, available MantiGO captain profile.
-- Source-only until review, isolated tests, and an approved release window.
create or replace function public.list_open_mantigo_rides_backend(p_user_id uuid)
returns table(
  id text,
  customer_name text,
  vehicle_category text,
  ride_type text,
  pickup_location text,
  destination_location text,
  proposed_price numeric,
  note text,
  status text,
  created_at timestamptz,
  bid_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then
    raise exception 'USER_CONTEXT_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.mantigo_captain_profiles cp
    where cp.captain_id = p_user_id
      and cp.status = 'ACTIVE'
      and cp.verification_status = 'VERIFIED'
      and cp.availability_status = 'AVAILABLE'
  ) then
    raise exception 'MANTIGO_CAPTAIN_PROFILE_REQUIRED';
  end if;

  return query
  select
    r.id,
    r.customer_name,
    r.vehicle_category,
    r.ride_type,
    r.pickup_location,
    r.destination_location,
    r.proposed_price,
    r.note,
    r.status,
    r.created_at,
    pg_catalog.count(b.id)::bigint
  from public.mantigo_rides r
  left join public.mantigo_bids b
    on b.ride_id = r.id
   and b.status = 'OFFERED'
  where r.status in ('OPEN', 'OPEN_FOR_BIDS')
    and r.customer_id <> p_user_id
  group by
    r.id, r.customer_name, r.vehicle_category, r.ride_type,
    r.pickup_location, r.destination_location, r.proposed_price,
    r.note, r.status, r.created_at
  order by r.created_at desc
  limit 100;
end;
$function$;

revoke all on function public.list_open_mantigo_rides_backend(uuid) from public, anon;
grant execute on function public.list_open_mantigo_rides_backend(uuid) to authenticated;
