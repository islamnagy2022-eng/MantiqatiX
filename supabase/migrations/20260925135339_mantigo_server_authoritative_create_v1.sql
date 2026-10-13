create or replace function public.mantigo_create_ride(
  p_vehicle_category text, p_ride_type text, p_pickup_location text, p_destination_location text,
  p_proposed_price numeric, p_note text default ''
) returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_pickup_location is null or btrim(p_pickup_location) = '' or p_destination_location is null or btrim(p_destination_location) = '' then raise exception 'INVALID_ROUTE'; end if;
  if p_proposed_price is null or p_proposed_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  v_id := 'ride_' || gen_random_uuid()::text;
  insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
  select v_id,v_uid,coalesce(u.raw_user_meta_data->>'full_name',''),coalesce(u.raw_user_meta_data->>'phone',''),p_vehicle_category,p_ride_type,btrim(p_pickup_location),btrim(p_destination_location),round(p_proposed_price,2),coalesce(p_note,''),'SEARCHING_BIDS'
  from auth.users u where u.id=v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_id;
end; $$;

create or replace function public.mantigo_submit_bid(
  p_ride_id text, p_offered_price numeric, p_captain_name text default '',
  p_vehicle_category text default 'MALAKI', p_vehicle_model text default '', p_captain_message text default ''
) returns text language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id text; v_customer uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_offered_price is null or p_offered_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  select customer_id into v_customer from public.mantigo_rides where id=p_ride_id and status='SEARCHING_BIDS';
  if v_customer is null then raise exception 'RIDE_NOT_FOUND_OR_CLOSED'; end if;
  if v_customer = v_uid then raise exception 'SELF_BID_NOT_ALLOWED'; end if;
  v_id := 'bid_' || gen_random_uuid()::text;
  insert into public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,vehicle_category,vehicle_model,offered_price,captain_message)
  select v_id,p_ride_id,v_uid,coalesce(nullif(btrim(p_captain_name),''),coalesce(u.raw_user_meta_data->>'full_name','')),coalesce(u.raw_user_meta_data->>'phone',''),p_vehicle_category,coalesce(p_vehicle_model,''),round(p_offered_price,2),coalesce(p_captain_message,'')
  from auth.users u where u.id=v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_id;
end; $$;

create or replace function public.mantigo_rate_ride(p_ride_id text, p_rating integer, p_comment text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_captain uuid; v_rating_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select b.captain_id into v_captain
  from public.mantigo_rides r join public.mantigo_bids b on b.id=r.accepted_bid_id
  where r.id=p_ride_id and r.customer_id=v_uid and r.status='COMPLETED';
  if v_captain is null then raise exception 'RIDE_NOT_COMPLETED_OR_NOT_OWNER'; end if;
  insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment)
  values(p_ride_id,v_uid,v_captain,p_rating,coalesce(p_comment,''))
  on conflict (ride_id,customer_id) do update set rating=excluded.rating, comment=excluded.comment
  returning id into v_rating_id;
  return v_rating_id;
end; $$;

revoke execute on function public.mantigo_create_ride(text,text,text,text,numeric,text) from public, anon, authenticated;
revoke execute on function public.mantigo_submit_bid(text,numeric,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.mantigo_rate_ride(text,integer,text) from public, anon, authenticated;
grant execute on function public.mantigo_create_ride(text,text,text,text,numeric,text) to authenticated;
grant execute on function public.mantigo_submit_bid(text,numeric,text,text,text,text) to authenticated;
grant execute on function public.mantigo_rate_ride(text,integer,text) to authenticated;
