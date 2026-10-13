
create or replace function public.restaurant_erp_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; v_owner uuid;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if;
 select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if;
 v_owner:=coalesce(nullif(p_payload->>'owner_user_id','')::uuid,v_uid);
 if v_owner<>v_uid and not public.is_platform_admin() then raise exception 'forbidden'; end if;

 if p_action='toggle_menu_availability' then
   update public.restaurant_menu_items set is_available=(p_payload->>'is_available')::boolean,updated_at=now()
   where id=p_payload->>'id' and owner_user_id=v_owner
   returning jsonb_build_object('id',id,'is_available',is_available) into v_result;
 elsif p_action='delete_menu_item' then
   delete from public.restaurant_menu_items where id=p_payload->>'id' and owner_user_id=v_owner
   returning jsonb_build_object('id',id,'deleted',true) into v_result;
 elsif p_action='restock_inventory' then
   update public.restaurant_inventory set current_stock_qty=current_stock_qty+(p_payload->>'added_qty')::numeric,updated_at=now()
   where id=p_payload->>'id' and owner_user_id=v_owner
   returning jsonb_build_object('id',id,'current_stock_qty',current_stock_qty) into v_result;
 else raise exception 'unsupported restaurant action';
 end if;

 if v_result is null then raise exception 'target not found or mutation failed'; end if;
 insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response)
 values('RESTAURANT_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')),v_result);
 return v_result;
end $$;

revoke all on function public.restaurant_erp_mutate(text,jsonb,text) from public,anon;
grant execute on function public.restaurant_erp_mutate(text,jsonb,text) to authenticated;
