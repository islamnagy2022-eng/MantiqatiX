-- MantiGO stale-request expiration engine.
create or replace function public.expire_stale_mantigo_rides_backend(p_admin_user_id uuid,p_age_minutes integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_count integer:=0; v_ride record;
begin
 if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not exists(select 1 from public.user_memberships where user_id=p_admin_user_id and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','MANAGER','OPERATIONS','OPERATIONS_MANAGER')) then raise exception 'OPERATIONS_ROLE_REQUIRED'; end if;
 if p_age_minutes is null or p_age_minutes<1 or p_age_minutes>10080 then raise exception 'INVALID_EXPIRATION_WINDOW'; end if;
 for v_ride in select id,customer_id,status,updated_at from public.mantigo_rides where status in ('OPEN','OPEN_FOR_BIDS') and updated_at < now()-make_interval(mins=>p_age_minutes) for update skip locked loop
  update public.mantigo_rides set status='EXPIRED',updated_at=now() where id=v_ride.id and status=v_ride.status;
  if found then
   v_count:=v_count+1;
   insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_RIDE_EXPIRED','MANTIGO_RIDE',v_ride.id,jsonb_build_object('status',v_ride.status,'updated_at',v_ride.updated_at),jsonb_build_object('status','EXPIRED','reason','STALE_REQUEST'),'SUCCESS');
   begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id) values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_ride.customer_id,'MANTIGO_EXPIRED','انتهى طلب الرحلة','انتهت مدة طلب الرحلة لعدم اكتمال المطابقة. يمكنك إنشاء طلب جديد.','MANTIGO_RIDE',v_ride.id);
   exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',v_ride.id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_EXPIRED','error',sqlerrm),'PARTIAL');
   end;
  end if;
 end loop;
 return jsonb_build_object('expired_count',v_count,'age_minutes',p_age_minutes);
end $function$;
revoke all on function public.expire_stale_mantigo_rides_backend(uuid,integer) from public,anon,authenticated;
grant execute on function public.expire_stale_mantigo_rides_backend(uuid,integer) to authenticated;