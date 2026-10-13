
create or replace function public.restaurant_table_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; v_owner uuid;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if;
 select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_TABLES' and actor_user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if;
 v_owner:=coalesce(nullif(p_payload->>'owner_user_id','')::uuid,v_uid);
 if v_owner<>v_uid and not public.is_platform_admin() then raise exception 'forbidden'; end if;

 if p_action='upsert_table' then
   insert into public.restaurant_tables(id,owner_user_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name)
   values(p_payload->>'id',v_owner,(p_payload->>'table_number')::integer,(p_payload->>'capacity_persons')::integer,coalesce(p_payload->>'status','AVAILABLE'),nullif(p_payload->>'current_active_order_id',''),coalesce((p_payload->>'current_bill_egp')::numeric,0),nullif(p_payload->>'reserved_customer_name',''))
   on conflict(id) do update set table_number=excluded.table_number,capacity_persons=excluded.capacity_persons,status=excluded.status,current_active_order_id=excluded.current_active_order_id,current_bill_egp=excluded.current_bill_egp,reserved_customer_name=excluded.reserved_customer_name
   returning to_jsonb(restaurant_tables.*) into v_result;
 elsif p_action='update_status' then
   update public.restaurant_tables set status=p_payload->>'status',current_active_order_id=nullif(p_payload->>'current_active_order_id',''),current_bill_egp=coalesce((p_payload->>'current_bill_egp')::numeric,current_bill_egp),reserved_customer_name=nullif(p_payload->>'reserved_customer_name','')
   where id=p_payload->>'id' and owner_user_id=v_owner
   returning to_jsonb(restaurant_tables.*) into v_result;
 elsif p_action='delete_table' then
   delete from public.restaurant_tables where id=p_payload->>'id' and owner_user_id=v_owner
   returning jsonb_build_object('id',id,'deleted',true) into v_result;
 else raise exception 'unsupported restaurant table action'; end if;
 if v_result is null then raise exception 'target not found or mutation failed'; end if;
 insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response)
 values('RESTAURANT_TABLES',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')),v_result);
 return v_result;
end $$;
revoke all on function public.restaurant_table_mutate(text,jsonb,text) from public,anon;
grant execute on function public.restaurant_table_mutate(text,jsonb,text) to authenticated;
revoke insert,update,delete on public.restaurant_tables from authenticated,anon;
