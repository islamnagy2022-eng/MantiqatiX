create or replace function public.mantigo_mutate(
  p_action text,
  p_payload jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ride_id text;
  bid_id text;
  v_ride public.mantigo_rides%rowtype;
  v_bid public.mantigo_bids%rowtype;
  v_captain_id uuid;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'anonymous_session_not_allowed'; end if;
  case p_action
    when 'create_ride' then
      ride_id := nullif(p_payload->>'id','');
      if ride_id is null then raise exception 'ride_id_required'; end if;
      insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
      values(ride_id,uid,coalesce(p_payload->>'customer_name',''),coalesce(p_payload->>'customer_phone',''),coalesce(p_payload->>'vehicle_category','MALAKI'),coalesce(p_payload->>'ride_type','PASSENGER_RIDE'),coalesce(p_payload->>'pickup_location',''),coalesce(p_payload->>'destination_location',''),(p_payload->>'proposed_price')::numeric,coalesce(p_payload->>'note',''),'SEARCHING_BIDS');
      return jsonb_build_object('ok',true,'action',p_action,'id',ride_id);
    when 'update_price' then
      ride_id := nullif(p_payload->>'ride_id','');
      update public.mantigo_rides set proposed_price=(p_payload->>'new_price')::numeric,updated_at=now() where id=ride_id and customer_id=uid and status='SEARCHING_BIDS';
      if not found then raise exception 'ride_not_owned_or_not_editable'; end if;
      return jsonb_build_object('ok',true,'action',p_action,'id',ride_id);
    when 'submit_bid' then
      ride_id := nullif(p_payload->>'ride_id','');
      if not exists(select 1 from public.mantigo_rides r where r.id=ride_id and r.status='SEARCHING_BIDS') then raise exception 'ride_not_open_for_bids'; end if;
      bid_id := nullif(p_payload->>'id','');
      if bid_id is null then raise exception 'bid_id_required'; end if;
      insert into public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,captain_rating,vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,captain_message)
      values(bid_id,ride_id,uid,coalesce(p_payload->>'captain_name',''),coalesce(p_payload->>'captain_phone',''),coalesce((p_payload->>'captain_rating')::numeric,0),coalesce(p_payload->>'vehicle_category','MALAKI'),coalesce(p_payload->>'vehicle_model',''),coalesce(p_payload->>'vehicle_plate',''),(p_payload->>'offered_price')::numeric,coalesce((p_payload->>'eta_minutes')::integer,0),coalesce(p_payload->>'captain_message',''));
      return jsonb_build_object('ok',true,'action',p_action,'id',bid_id);
    when 'accept_bid' then
      ride_id := nullif(p_payload->>'ride_id','');
      bid_id := nullif(p_payload->>'bid_id','');
      select b.* into v_bid from public.mantigo_bids b where b.id=bid_id and b.ride_id=ride_id;
      if not found then raise exception 'bid_not_found'; end if;
      update public.mantigo_rides set status='ACCEPTED',accepted_bid_id=bid_id,updated_at=now() where id=ride_id and customer_id=uid and status='SEARCHING_BIDS';
      if not found then raise exception 'ride_not_owned_or_not_searching'; end if;
      return jsonb_build_object('ok',true,'action',p_action,'ride_id',ride_id,'bid_id',bid_id);
    when 'cancel_ride' then
      ride_id := nullif(p_payload->>'ride_id','');
      update public.mantigo_rides set status='CANCELLED',updated_at=now() where id=ride_id and customer_id=uid and status not in ('COMPLETED','CANCELLED');
      if not found then raise exception 'ride_not_owned_or_not_cancellable'; end if;
      return jsonb_build_object('ok',true,'action',p_action,'id',ride_id);
    when 'rate_ride' then
      ride_id := nullif(p_payload->>'ride_id','');
      select r.* into v_ride from public.mantigo_rides r where r.id=ride_id and r.customer_id=uid and r.status='COMPLETED';
      if not found then raise exception 'ride_not_completed_or_not_owned'; end if;
      select b.captain_id into v_captain_id from public.mantigo_bids b where b.id=v_ride.accepted_bid_id and b.ride_id=ride_id;
      if v_captain_id is null then raise exception 'accepted_captain_not_found'; end if;
      insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment) values(ride_id,uid,v_captain_id,(p_payload->>'rating')::integer,coalesce(p_payload->>'comment',''));
      return jsonb_build_object('ok',true,'action',p_action,'ride_id',ride_id);
    else raise exception 'unsupported_action';
  end case;
end;
$$;
revoke execute on function public.mantigo_mutate(text,jsonb) from public,anon;
grant execute on function public.mantigo_mutate(text,jsonb) to authenticated;
