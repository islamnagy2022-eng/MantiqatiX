-- RC469: enforce captain verification and fresh coordinates in the authoritative RPC.
-- The frontend guard is UX only; the SECURITY DEFINER function must enforce the rule itself.
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
declare v_category text; v_status text; v_verification text; v_saved_lat double precision; v_saved_lon double precision;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_availability_status is null or p_availability_status not in ('OFFLINE','AVAILABLE','BUSY') then raise exception 'INVALID_AVAILABILITY_STATUS'; end if;
  if (p_current_lat is null) <> (p_current_lon is null) then raise exception 'INVALID_COORDINATE_PAIR'; end if;
  if p_current_lat is not null and (p_current_lat < -90 or p_current_lat > 90) then raise exception 'INVALID_LATITUDE'; end if;
  if p_current_lon is not null and (p_current_lon < -180 or p_current_lon > 180) then raise exception 'INVALID_LONGITUDE'; end if;

  select status,verification_status into v_status,v_verification
    from public.mantigo_captain_profiles where captain_id=p_user_id for update;
  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;
  if p_availability_status='AVAILABLE' and (v_status is distinct from 'ACTIVE' or v_verification is distinct from 'VERIFIED') then
    raise exception 'CAPTAIN_NOT_VERIFIED_FOR_AVAILABILITY';
  end if;
  if p_availability_status='AVAILABLE' and (p_current_lat is null or p_current_lon is null) then
    raise exception 'CAPTAIN_LOCATION_REQUIRED_FOR_AVAILABILITY';
  end if;

  update public.mantigo_captain_profiles
     set availability_status=p_availability_status,
         current_lat=coalesce(p_current_lat,current_lat),
         current_lon=coalesce(p_current_lon,current_lon),
         last_seen_at=now(),
         updated_at=now()
   where captain_id=p_user_id
   returning vehicle_category,status,verification_status,current_lat,current_lon into v_category,v_status,v_verification,v_saved_lat,v_saved_lon;



  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),
    'MNTY-PLATFORM',p_user_id,'MANTIGO_CAPTAIN_PRESENCE_UPDATED','MANTIGO_CAPTAIN',
    p_user_id::text,'{}'::jsonb,
    jsonb_build_object('availability_status',p_availability_status,'has_coordinates',v_saved_lat is not null and v_saved_lon is not null),
    'SUCCESS'
  );
  return jsonb_build_object('captain_id',p_user_id,'availability_status',p_availability_status,'vehicle_category',v_category,'status',v_status,'verification_status',v_verification);
end
$function$;

revoke all on function public.update_mantigo_captain_presence_backend(uuid,text,double precision,double precision) from public, anon;
grant execute on function public.update_mantigo_captain_presence_backend(uuid,text,double precision,double precision) to authenticated;
