-- MantiGO Captain boundary hardening v1.
-- Captains may update presence/location only through the authoritative RPC.
-- Verification and activation remain administrative/server-controlled.

drop policy if exists mantigo_captain_self_update on public.mantigo_captain_profiles;
revoke update on public.mantigo_captain_profiles from anon, authenticated;

create or replace function public.update_mantigo_captain_presence_backend(
  p_user_id uuid,
  p_availability_status text,
  p_current_lat double precision default null,
  p_current_lon double precision default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_category text; v_status text; v_verification text;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_availability_status not in ('OFFLINE','AVAILABLE','BUSY') then raise exception 'INVALID_AVAILABILITY_STATUS'; end if;
  if p_current_lat is not null and (p_current_lat < -90 or p_current_lat > 90) then raise exception 'INVALID_LATITUDE'; end if;
  if p_current_lon is not null and (p_current_lon < -180 or p_current_lon > 180) then raise exception 'INVALID_LONGITUDE'; end if;

  update public.mantigo_captain_profiles
     set availability_status=p_availability_status,
         current_lat=coalesce(p_current_lat,current_lat),
         current_lon=coalesce(p_current_lon,current_lon),
         last_seen_at=now(),
         updated_at=now()
   where captain_id=p_user_id
   returning vehicle_category,status,verification_status into v_category,v_status,v_verification;

  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),
    'MNTY-PLATFORM',p_user_id,'MANTIGO_CAPTAIN_PRESENCE_UPDATED','MANTIGO_CAPTAIN',
    p_user_id::text,'{}'::jsonb,
    jsonb_build_object('availability_status',p_availability_status,'has_coordinates',p_current_lat is not null and p_current_lon is not null),
    'SUCCESS'
  );
  return jsonb_build_object('captain_id',p_user_id,'availability_status',p_availability_status,'vehicle_category',v_category,'status',v_status,'verification_status',v_verification);
end
$function$;

revoke all on function public.update_mantigo_captain_presence_backend(uuid,text,double precision,double precision) from public, anon;
grant execute on function public.update_mantigo_captain_presence_backend(uuid,text,double precision,double precision) to authenticated;

create or replace function public.create_mantigo_bid_backend(
  p_user_id uuid, p_ride_id text, p_captain_name text, p_captain_phone text,
  p_captain_rating numeric, p_vehicle_category text, p_vehicle_model text,
  p_vehicle_plate text, p_offered_price numeric, p_eta_minutes integer, p_captain_message text
) returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare
  v_id text:='BID-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  v_customer uuid; v_profile public.mantigo_captain_profiles%rowtype;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_offered_price is null or p_offered_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
  if coalesce(p_eta_minutes,0)<0 then raise exception 'INVALID_ETA'; end if;

  select * into v_profile
  from public.mantigo_captain_profiles
  where captain_id=p_user_id
  for update;

  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;
  if v_profile.status <> 'ACTIVE' then raise exception 'CAPTAIN_NOT_ACTIVE'; end if;
  if v_profile.verification_status <> 'VERIFIED' then raise exception 'CAPTAIN_NOT_VERIFIED'; end if;
  if v_profile.availability_status <> 'AVAILABLE' then raise exception 'CAPTAIN_NOT_AVAILABLE'; end if;
  if v_profile.vehicle_category is null or trim(v_profile.vehicle_category)='' then raise exception 'CAPTAIN_VEHICLE_NOT_CONFIGURED'; end if;

  select customer_id into v_customer
  from public.mantigo_rides
  where id=p_ride_id and status in ('OPEN','OPEN_FOR_BIDS')
    and vehicle_category = v_profile.vehicle_category
  for update;
  if v_customer is null then raise exception 'RIDE_NOT_OPEN_OR_VEHICLE_MISMATCH'; end if;
  if v_customer=p_user_id then raise exception 'CAPTAIN_CANNOT_BID_OWN_RIDE'; end if;

  insert into public.mantigo_bids(
    id,ride_id,captain_id,captain_name,captain_phone,captain_rating,
    vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,captain_message,status
  ) values(
    v_id,p_ride_id,p_user_id,
    coalesce(nullif(trim(p_captain_name),''),'كابتن MantiGO'),
    coalesce(trim(p_captain_phone),''),
    greatest(0,coalesce(v_profile.rating,0)),
    v_profile.vehicle_category,
    coalesce(v_profile.vehicle_model,''),
    coalesce(v_profile.vehicle_plate,''),
    p_offered_price,greatest(0,coalesce(p_eta_minutes,0)),
    coalesce(trim(p_captain_message),''),'OFFERED'
  )
  on conflict (ride_id,captain_id) do update set
    captain_name=excluded.captain_name,captain_phone=excluded.captain_phone,
    captain_rating=excluded.captain_rating,vehicle_category=excluded.vehicle_category,
    vehicle_model=excluded.vehicle_model,vehicle_plate=excluded.vehicle_plate,
    offered_price=excluded.offered_price,eta_minutes=excluded.eta_minutes,
    captain_message=excluded.captain_message,status='OFFERED',created_at=now()
  returning id into v_id;

  update public.mantigo_rides set status=case when status='OPEN' then 'OPEN_FOR_BIDS' else status end,updated_at=now()
  where id=p_ride_id;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_BID_CREATED','MANTIGO_BID',v_id,'{}'::jsonb,
    jsonb_build_object('ride_id',p_ride_id,'status','OFFERED','offered_price',p_offered_price,'vehicle_category',v_profile.vehicle_category),'SUCCESS');

  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_customer,'MANTIGO_BID','عرض جديد على رحلتك MantiGO',
      'تم استلام عرض جديد بقيمة '||to_char(p_offered_price,'FM999999990D00')||' ج.م','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      jsonb_build_object('notification_type','MANTIGO_BID','error',sqlerrm),'PARTIAL');
  end;
  return jsonb_build_object('id',v_id,'status','OFFERED');
end
$function$;

revoke all on function public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) from public, anon;
grant execute on function public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) to authenticated;
