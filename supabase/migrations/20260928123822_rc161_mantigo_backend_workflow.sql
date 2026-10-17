create or replace function public.create_mantigo_ride_backend(
 p_user_id uuid,p_customer_name text,p_customer_phone text,p_vehicle_category text,p_ride_type text,
 p_pickup_location text,p_destination_location text,p_proposed_price numeric,p_note text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text:='RIDE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if p_pickup_location is null or trim(p_pickup_location)='' or p_destination_location is null or trim(p_destination_location)='' then raise exception 'ROUTE_REQUIRED'; end if;
 if p_proposed_price is null or p_proposed_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
 insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
 values(v_id,p_user_id,p_customer_name,p_customer_phone,p_vehicle_category,p_ride_type,trim(p_pickup_location),trim(p_destination_location),p_proposed_price,p_note,'OPEN');
 return jsonb_build_object('id',v_id,'status','OPEN');
end $$;

create or replace function public.create_mantigo_bid_backend(
 p_user_id uuid,p_ride_id text,p_captain_name text,p_captain_phone text,p_captain_rating numeric,
 p_vehicle_category text,p_vehicle_model text,p_vehicle_plate text,p_offered_price numeric,p_eta_minutes integer,p_captain_message text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text:='BID-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not exists(select 1 from public.mantigo_rides where id=p_ride_id and status in ('OPEN','OPEN_FOR_BIDS')) then raise exception 'RIDE_NOT_OPEN'; end if;
 if p_offered_price is null or p_offered_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
 insert into public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,captain_rating,vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,captain_message)
 values(v_id,p_ride_id,p_user_id,p_captain_name,p_captain_phone,p_captain_rating,p_vehicle_category,p_vehicle_model,p_vehicle_plate,p_offered_price,p_eta_minutes,p_captain_message);
 return jsonb_build_object('id',v_id,'status','OFFERED');
end $$;

create or replace function public.accept_mantigo_bid_backend(
 p_user_id uuid,p_ride_id text,p_bid_id text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 select status into v_status from public.mantigo_rides where id=p_ride_id and customer_id=p_user_id for update;
 if v_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_status not in ('OPEN','OPEN_FOR_BIDS') then raise exception 'RIDE_NOT_OPEN'; end if;
 if not exists(select 1 from public.mantigo_bids where id=p_bid_id and ride_id=p_ride_id) then raise exception 'BID_NOT_FOUND'; end if;
 update public.mantigo_rides set accepted_bid_id=p_bid_id,status='ACCEPTED',updated_at=now() where id=p_ride_id;
 return jsonb_build_object('id',p_ride_id,'accepted_bid_id',p_bid_id,'status','ACCEPTED');
end $$;

revoke all on function public.create_mantigo_ride_backend(uuid,text,text,text,text,text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) from public,anon,authenticated;
revoke all on function public.accept_mantigo_bid_backend(uuid,text,text) from public,anon,authenticated;