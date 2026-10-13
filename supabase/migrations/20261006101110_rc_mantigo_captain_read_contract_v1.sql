
create or replace function public.list_open_mantigo_rides_backend(p_user_id uuid)
returns table(
 id text,customer_name text,vehicle_category text,ride_type text,
 pickup_location text,destination_location text,proposed_price numeric,
 note text,status text,created_at timestamptz,bid_count bigint
)
language plpgsql security definer set search_path=public
as $$
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 return query
 select r.id,r.customer_name,r.vehicle_category,r.ride_type,
        r.pickup_location,r.destination_location,r.proposed_price,r.note,r.status,r.created_at,
        count(b.id)::bigint
 from public.mantigo_rides r
 left join public.mantigo_bids b on b.ride_id=r.id and b.status='OFFERED'
 where r.status in ('OPEN','OPEN_FOR_BIDS') and r.customer_id<>p_user_id
 group by r.id
 order by r.created_at desc
 limit 100;
end $$;

create or replace function public.list_mantigo_captain_rides_backend(p_user_id uuid)
returns table(
 id text,customer_name text,vehicle_category text,ride_type text,
 pickup_location text,destination_location text,proposed_price numeric,
 accepted_bid_id text,status text,updated_at timestamptz
)
language plpgsql security definer set search_path=public
as $$
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 return query
 select r.id,r.customer_name,r.vehicle_category,r.ride_type,
        r.pickup_location,r.destination_location,r.proposed_price,r.accepted_bid_id,r.status,r.updated_at
 from public.mantigo_rides r
 join public.mantigo_bids b on b.ride_id=r.id and b.captain_id=p_user_id and b.status='ACCEPTED'
 order by r.updated_at desc
 limit 100;
end $$;

grant execute on function public.list_open_mantigo_rides_backend(uuid) to authenticated;
grant execute on function public.list_mantigo_captain_rides_backend(uuid) to authenticated;
