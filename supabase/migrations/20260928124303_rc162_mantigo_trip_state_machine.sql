create or replace function public.update_mantigo_trip_status_backend(p_user_id uuid,p_ride_id text,p_target_status text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status text; v_customer uuid; v_driver uuid; v_target text:=upper(trim(p_target_status)); v_ok boolean:=false;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 select r.status,r.customer_id,b.captain_id into v_status,v_customer,v_driver from public.mantigo_rides r left join public.mantigo_bids b on b.id=r.accepted_bid_id where r.id=p_ride_id for update;
 if v_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
 if p_user_id=v_customer then
   v_ok := (v_status='OPEN' and v_target in ('OPEN_FOR_BIDS','CANCELLED','EXPIRED')) or (v_status='OPEN_FOR_BIDS' and v_target in ('MATCHING','CANCELLED','EXPIRED')) or (v_status='MATCHING' and v_target='ACCEPTED');
 elsif p_user_id=v_driver then
   v_ok := (v_status='ACCEPTED' and v_target='ARRIVED') or (v_status='STARTED' and v_target='IN_PROGRESS') or (v_status='IN_PROGRESS' and v_target='COMPLETED') or (v_status in ('ACCEPTED','ARRIVED','STARTED','IN_PROGRESS') and v_target in ('FAILED','SHOW_NO')) or (v_status in ('ACCEPTED','ARRIVED') and v_target='CANCELLED');
 else raise exception 'TRIP_ACTOR_FORBIDDEN'; end if;
 if not v_ok then raise exception 'INVALID_TRIP_TRANSITION'; end if;
 update public.mantigo_rides set status=v_target,updated_at=now() where id=p_ride_id;
 return jsonb_build_object('id',p_ride_id,'previous_status',v_status,'status',v_target,'reason',p_reason);
end $$;
revoke all on function public.update_mantigo_trip_status_backend(uuid,text,text,text) from public,anon,authenticated;
