begin;

-- P0: backend-only MantiGO RPCs must never be callable anonymously/publicly.
revoke all on function public.create_mantigo_ride_backend(uuid,text,text,text,text,text,text,numeric,text) from public, anon;
revoke all on function public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) from public, anon;
revoke all on function public.accept_mantigo_bid_backend(uuid,text,text) from public, anon;
revoke all on function public.update_mantigo_trip_status_backend(uuid,text,text,text) from public, anon;
revoke all on function public.mantigo_rate_ride(text,integer,text) from public, anon;
revoke all on function public.list_open_mantigo_rides_backend(uuid) from public, anon;
revoke all on function public.list_mantigo_captain_rides_backend(uuid) from public, anon;

grant execute on function public.create_mantigo_ride_backend(uuid,text,text,text,text,text,text,numeric,text) to authenticated;
grant execute on function public.create_mantigo_bid_backend(uuid,text,text,text,numeric,text,text,text,numeric,integer,text) to authenticated;
grant execute on function public.accept_mantigo_bid_backend(uuid,text,text) to authenticated;
grant execute on function public.update_mantigo_trip_status_backend(uuid,text,text,text) to authenticated;
grant execute on function public.mantigo_rate_ride(text,integer,text) to authenticated;
grant execute on function public.list_open_mantigo_rides_backend(uuid) to authenticated;
grant execute on function public.list_mantigo_captain_rides_backend(uuid) to authenticated;

-- Create ride: keep the existing contract, but make notification delivery best-effort
-- and record the authoritative state change in the existing immutable audit log.
create or replace function public.create_mantigo_ride_backend(
  p_user_id uuid,p_customer_name text,p_customer_phone text,p_vehicle_category text,
  p_ride_type text,p_pickup_location text,p_destination_location text,
  p_proposed_price numeric,p_note text
) returns jsonb
language plpgsql security definer set search_path=public as $function$
declare
  v_id text:='RIDE-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if coalesce(trim(p_pickup_location),'')='' or coalesce(trim(p_destination_location),'')='' then raise exception 'ROUTE_REQUIRED'; end if;
  if p_proposed_price is null or p_proposed_price<=0 then raise exception 'PRICE_REQUIRED'; end if;

  insert into public.mantigo_rides(
    id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,
    pickup_location,destination_location,proposed_price,note,status
  ) values (
    v_id,p_user_id,coalesce(nullif(trim(p_customer_name),''),'عميل MantiGO'),
    coalesce(trim(p_customer_phone),''),trim(p_vehicle_category),trim(p_ride_type),
    trim(p_pickup_location),trim(p_destination_location),p_proposed_price,
    coalesce(p_note,''),'OPEN'
  );

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values (
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_RIDE_CREATED','MANTIGO_RIDE',v_id,'{}'::jsonb,
    jsonb_build_object('status','OPEN','proposed_price',p_proposed_price,
      'pickup_location',trim(p_pickup_location),'destination_location',trim(p_destination_location)),
    'SUCCESS'
  );

  begin
    insert into public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id
    ) values (
      'NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
      'MANTIGO_CREATED','تم إنشاء طلب الرحلة','تم إنشاء طلب رحلتك بنجاح.',
      'MANTIGO_RIDE',v_id
    );
  exception when others then
    insert into public.audit_logs(
      id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
    ) values (
      'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
      'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_id,'{}'::jsonb,
      jsonb_build_object('notification_type','MANTIGO_CREATED','error',sqlerrm),
      'PARTIAL'
    );
  end;

  return jsonb_build_object('id',v_id,'status','OPEN');
end $function$;

-- Bid creation: retain the existing upsert/idempotent ride+captain uniqueness,
-- but do not let notification delivery roll back the bid itself.
create or replace function public.create_mantigo_bid_backend(
  p_user_id uuid,p_ride_id text,p_captain_name text,p_captain_phone text,
  p_captain_rating numeric,p_vehicle_category text,p_vehicle_model text,
  p_vehicle_plate text,p_offered_price numeric,p_eta_minutes integer,
  p_captain_message text
) returns jsonb
language plpgsql security definer set search_path=public as $function$
declare
  v_id text:='BID-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  v_customer uuid;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
  if p_offered_price is null or p_offered_price<=0 then raise exception 'PRICE_REQUIRED'; end if;
  if coalesce(p_eta_minutes,0)<0 then raise exception 'INVALID_ETA'; end if;

  select customer_id into v_customer
  from public.mantigo_rides
  where id=p_ride_id and status in ('OPEN','OPEN_FOR_BIDS')
  for update;

  if v_customer is null then raise exception 'RIDE_NOT_OPEN'; end if;
  if v_customer=p_user_id then raise exception 'CAPTAIN_CANNOT_BID_OWN_RIDE'; end if;

  insert into public.mantigo_bids(
    id,ride_id,captain_id,captain_name,captain_phone,captain_rating,
    vehicle_category,vehicle_model,vehicle_plate,offered_price,eta_minutes,
    captain_message,status
  ) values (
    v_id,p_ride_id,p_user_id,coalesce(nullif(trim(p_captain_name),''),'كابتن MantiGO'),
    coalesce(trim(p_captain_phone),''),greatest(0,coalesce(p_captain_rating,0)),
    trim(p_vehicle_category),trim(p_vehicle_model),coalesce(trim(p_vehicle_plate),''),
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

  update public.mantigo_rides
  set status=case when status='OPEN' then 'OPEN_FOR_BIDS' else status end,updated_at=now()
  where id=p_ride_id;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values (
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_BID_CREATED','MANTIGO_BID',v_id,'{}'::jsonb,
    jsonb_build_object('ride_id',p_ride_id,'status','OFFERED','offered_price',p_offered_price,
      'eta_minutes',greatest(0,coalesce(p_eta_minutes,0))),
    'SUCCESS'
  );

  begin
    insert into public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id
    ) values (
      'NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_customer,
      'MANTIGO_BID','عرض جديد على رحلتك MantiGO',
      'تم استلام عرض جديد بقيمة '||to_char(p_offered_price,'FM999999990D00')||' ج.م',
      'MANTIGO_RIDE',p_ride_id
    );
  exception when others then
    insert into public.audit_logs(
      id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
    ) values (
      'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
      'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      jsonb_build_object('notification_type','MANTIGO_BID','error',sqlerrm),
      'PARTIAL'
    );
  end;

  return jsonb_build_object('id',v_id,'status','OFFERED');
end $function$;

-- Acceptance remains row-locked and single-winner; notification is best-effort.
create or replace function public.accept_mantigo_bid_backend(
  p_user_id uuid,p_ride_id text,p_bid_id text
) returns jsonb
language plpgsql security definer set search_path=public as $function$
declare
  v_status text; v_customer uuid; v_captain uuid; v_price numeric;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;

  select r.status,r.customer_id,b.captain_id,b.offered_price
  into v_status,v_customer,v_captain,v_price
  from public.mantigo_rides r
  join public.mantigo_bids b on b.ride_id=r.id and b.id=p_bid_id
  where r.id=p_ride_id and r.customer_id=p_user_id
  for update of r;

  if v_status is null then raise exception 'RIDE_OR_BID_NOT_FOUND'; end if;
  if v_status not in ('OPEN','OPEN_FOR_BIDS','MATCHING') then raise exception 'RIDE_NOT_OPEN'; end if;

  update public.mantigo_bids set status='REJECTED'
  where ride_id=p_ride_id and status='OFFERED' and id<>p_bid_id;
  update public.mantigo_bids set status='ACCEPTED'
  where id=p_bid_id and ride_id=p_ride_id;
  update public.mantigo_rides set accepted_bid_id=p_bid_id,status='ACCEPTED',updated_at=now()
  where id=p_ride_id;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values (
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_BID_ACCEPTED','MANTIGO_RIDE',p_ride_id,
    jsonb_build_object('status',v_status),
    jsonb_build_object('status','ACCEPTED','accepted_bid_id',p_bid_id,'captain_id',v_captain),
    'SUCCESS'
  );

  begin
    insert into public.notifications(
      id,tenant_id,user_id,type,title,body,entity_type,entity_id
    ) values (
      'NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_captain,
      'MANTIGO_ACCEPTED','تم قبول عرضك في MantiGO',
      'تم قبول عرضك للرحلة بقيمة '||to_char(v_price,'FM999999990D00')||' ج.م',
      'MANTIGO_RIDE',p_ride_id
    );
  exception when others then
    insert into public.audit_logs(
      id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
    ) values (
      'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
      'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
      jsonb_build_object('notification_type','MANTIGO_ACCEPTED','error',sqlerrm),
      'PARTIAL'
    );
  end;

  return jsonb_build_object('id',p_ride_id,'accepted_bid_id',p_bid_id,'status','ACCEPTED');
end $function$;

-- State machine: backend remains the source of truth; audit is mandatory,
-- notification delivery is isolated from the state transition transaction.
create or replace function public.update_mantigo_trip_status_backend(
  p_user_id uuid,p_ride_id text,p_target_status text,p_reason text default null
) returns jsonb
language plpgsql security definer set search_path=public as $function$
declare
  v_status text; v_customer uuid; v_driver uuid; v_target text:=upper(trim(p_target_status));
  v_ok boolean:=false; v_other uuid; v_title text; v_body text;
begin
  if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;

  select r.status,r.customer_id,b.captain_id
  into v_status,v_customer,v_driver
  from public.mantigo_rides r
  left join public.mantigo_bids b on b.id=r.accepted_bid_id
  where r.id=p_ride_id
  for update;

  if v_status is null then raise exception 'RIDE_NOT_FOUND'; end if;

  if p_user_id=v_customer then
    v_ok:=(v_status in ('OPEN','OPEN_FOR_BIDS','MATCHING') and v_target in ('CANCELLED','EXPIRED'))
       or (v_status='MATCHING' and v_target='ACCEPTED');
  elsif p_user_id=v_driver then
    v_ok:=(v_status='ACCEPTED' and v_target='ARRIVED')
       or (v_status='ARRIVED' and v_target='STARTED')
       or (v_status='STARTED' and v_target='IN_PROGRESS')
       or (v_status='IN_PROGRESS' and v_target='COMPLETED')
       or (v_status in ('ACCEPTED','ARRIVED','STARTED','IN_PROGRESS') and v_target in ('FAILED','SHOW_NO'))
       or (v_status in ('ACCEPTED','ARRIVED') and v_target='CANCELLED');
  else
    raise exception 'TRIP_ACTOR_FORBIDDEN';
  end if;

  if not v_ok then raise exception 'INVALID_TRIP_TRANSITION'; end if;

  update public.mantigo_rides set status=v_target,updated_at=now() where id=p_ride_id;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values (
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
    'MANTIGO_TRIP_STATUS_CHANGED','MANTIGO_RIDE',p_ride_id,
    jsonb_build_object('status',v_status),
    jsonb_build_object('status',v_target,'reason',p_reason,'accepted_bid_id',(select accepted_bid_id from public.mantigo_rides where id=p_ride_id)),
    'SUCCESS'
  );

  v_other:=case when p_user_id=v_customer then v_driver else v_customer end;
  if v_other is not null then
    v_title:=case v_target
      when 'ARRIVED' then 'الكابتن وصل'
      when 'STARTED' then 'بدأت الرحلة'
      when 'IN_PROGRESS' then 'الرحلة جارية'
      when 'COMPLETED' then 'اكتملت الرحلة'
      when 'CANCELLED' then 'تم إلغاء الرحلة'
      when 'FAILED' then 'تعذر إكمال الرحلة'
      when 'SHOW_NO' then 'لم يتم الحضور'
      else 'تحديث رحلة MantiGO' end;
    v_body:=coalesce(p_reason,'تم تحديث حالة رحلتك إلى '||v_target);
    begin
      insert into public.notifications(
        id,tenant_id,user_id,type,title,body,entity_type,entity_id
      ) values (
        'NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_other,
        'MANTIGO_STATUS',v_title,v_body,'MANTIGO_RIDE',p_ride_id
      );
    exception when others then
      insert into public.audit_logs(
        id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
      ) values (
        'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,
        'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
        jsonb_build_object('notification_type','MANTIGO_STATUS','target_status',v_target,'error',sqlerrm),
        'PARTIAL'
      );
    end;
  end if;

  return jsonb_build_object('id',p_ride_id,'previous_status',v_status,'status',v_target,'reason',p_reason);
end $function$;

-- Rating is already idempotent by (ride_id, customer_id); add an audit record.
create or replace function public.mantigo_rate_ride(
  p_ride_id text,p_rating integer,p_comment text default ''
) returns uuid
language plpgsql security definer set search_path=public as $function$
declare
  v_uid uuid:=auth.uid(); v_captain uuid; v_rating_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;

  select b.captain_id into v_captain
  from public.mantigo_rides r
  join public.mantigo_bids b on b.id=r.accepted_bid_id
  where r.id=p_ride_id and r.customer_id=v_uid and r.status='COMPLETED';

  if v_captain is null then raise exception 'RIDE_NOT_COMPLETED_OR_NOT_OWNER'; end if;

  insert into public.mantigo_ride_ratings(
    ride_id,customer_id,captain_id,rating,comment
  ) values(
    p_ride_id,v_uid,v_captain,p_rating,coalesce(p_comment,'')
  )
  on conflict (ride_id,customer_id) do update
  set rating=excluded.rating,comment=excluded.comment
  returning id into v_rating_id;

  insert into public.audit_logs(
    id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result
  ) values (
    'AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,
    'MANTIGO_RIDE_RATED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,
    jsonb_build_object('rating',p_rating,'comment',coalesce(p_comment,'')),
    'SUCCESS'
  );

  return v_rating_id;
end $function$;

commit;