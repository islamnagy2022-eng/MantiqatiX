-- MantiGO ratings: immutable final rating with safe idempotent replay.
create or replace function public.mantigo_rate_ride(p_ride_id text,p_rating integer,p_comment text default '')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_captain uuid; v_rating_id uuid; v_existing public.mantigo_ride_ratings%rowtype; v_comment text:=coalesce(p_comment,'');
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select b.captain_id into v_captain from public.mantigo_rides r join public.mantigo_bids b on b.id=r.accepted_bid_id where r.id=p_ride_id and r.customer_id=v_uid and r.status='COMPLETED';
  if v_captain is null then raise exception 'RIDE_NOT_COMPLETED_OR_NOT_OWNER'; end if;
  select * into v_existing from public.mantigo_ride_ratings where ride_id=p_ride_id and customer_id=v_uid for update;
  if found then
    if v_existing.rating=p_rating and v_existing.comment=v_comment then return v_existing.id; end if;
    raise exception 'RATING_ALREADY_SUBMITTED';
  end if;
  insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment) values(p_ride_id,v_uid,v_captain,p_rating,v_comment) returning id into v_rating_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_RIDE_RATED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('rating',p_rating,'comment',v_comment),'SUCCESS');
  return v_rating_id;
end $function$;
revoke all on function public.mantigo_rate_ride(text,integer,text) from public;
revoke all on function public.mantigo_rate_ride(text,integer,text) from anon;
grant execute on function public.mantigo_rate_ride(text,integer,text) to authenticated;
