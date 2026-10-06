-- MantiGO Captain onboarding and administrative review v1.

create or replace function public.submit_mantigo_captain_application(
  p_user_id uuid,
  p_vehicle_category text,
  p_vehicle_model text,
  p_vehicle_plate text,
  p_service_areas jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_existing public.mantigo_captain_profiles%rowtype;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if coalesce(trim(p_vehicle_category),'')='' then raise exception 'VEHICLE_CATEGORY_REQUIRED'; end if;
  if coalesce(trim(p_vehicle_model),'')='' then raise exception 'VEHICLE_MODEL_REQUIRED'; end if;
  if coalesce(trim(p_vehicle_plate),'')='' then raise exception 'VEHICLE_PLATE_REQUIRED'; end if;
  if p_service_areas is null or jsonb_typeof(p_service_areas) <> 'array' then raise exception 'INVALID_SERVICE_AREAS'; end if;

  select * into v_existing from public.mantigo_captain_profiles where captain_id=p_user_id;
  if found then
    if v_existing.status='REJECTED' then
      raise exception 'CAPTAIN_APPLICATION_REQUIRES_ADMIN_REVIEW';
    end if;
    return jsonb_build_object(
      'captain_id',p_user_id,'status',v_existing.status,
      'verification_status',v_existing.verification_status,'idempotent',true
    );
  end if;

  insert into public.mantigo_captain_profiles(
    captain_id,status,verification_status,availability_status,
    vehicle_category,vehicle_model,vehicle_plate,service_areas,
    rating,completed_rides,acceptance_rate,cancellation_rate,last_seen_at
  ) values(
    p_user_id,'PENDING','PENDING','OFFLINE',
    trim(p_vehicle_category),trim(p_vehicle_model),trim(p_vehicle_plate),p_service_areas,
    0,0,0,0,null
  );

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_CAPTAIN_APPLICATION_SUBMITTED','MANTIGO_CAPTAIN',p_user_id::text,
    '{}'::jsonb,jsonb_build_object('status','PENDING','verification_status','PENDING'),'SUCCESS'
  );

  return jsonb_build_object('captain_id',p_user_id,'status','PENDING','verification_status','PENDING','idempotent',false);
end
$function$;

revoke all on function public.submit_mantigo_captain_application(uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.submit_mantigo_captain_application(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.review_mantigo_captain_application(
  p_admin_user_id uuid,
  p_captain_id uuid,
  p_decision text,
  p_vehicle_category text default null,
  p_vehicle_model text default null,
  p_vehicle_plate text default null,
  p_service_areas jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_status text; v_verification text;
begin
  if p_admin_user_id is null or p_admin_user_id <> auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if not public.mnty_can_platform_admin() then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if p_captain_id is null then raise exception 'CAPTAIN_REQUIRED'; end if;
  if upper(p_decision) not in ('APPROVE','REJECT','SUSPEND') then raise exception 'INVALID_REVIEW_DECISION'; end if;
  if p_service_areas is not null and jsonb_typeof(p_service_areas) <> 'array' then raise exception 'INVALID_SERVICE_AREAS'; end if;

  if upper(p_decision)='APPROVE' then
    v_status:='ACTIVE'; v_verification:='VERIFIED';
  elsif upper(p_decision)='SUSPEND' then
    v_status:='SUSPENDED'; v_verification:='VERIFIED';
  else
    v_status:='REJECTED'; v_verification:='REJECTED';
  end if;

  update public.mantigo_captain_profiles
     set status=v_status,
         verification_status=v_verification,
         availability_status='OFFLINE',
         vehicle_category=coalesce(nullif(trim(p_vehicle_category),''),vehicle_category),
         vehicle_model=coalesce(nullif(trim(p_vehicle_model),''),vehicle_model),
         vehicle_plate=coalesce(nullif(trim(p_vehicle_plate),''),vehicle_plate),
         service_areas=coalesce(p_service_areas,service_areas),
         updated_at=now()
   where captain_id=p_captain_id;

  if not found then raise exception 'CAPTAIN_PROFILE_NOT_FOUND'; end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,
    'MANTIGO_CAPTAIN_APPLICATION_REVIEWED','MANTIGO_CAPTAIN',p_captain_id::text,
    '{}'::jsonb,jsonb_build_object('decision',upper(p_decision),'status',v_status,'verification_status',v_verification),'SUCCESS'
  );

  return jsonb_build_object('captain_id',p_captain_id,'status',v_status,'verification_status',v_verification);
end
$function$;

revoke all on function public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb) from public, anon;
grant execute on function public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb) to authenticated;
