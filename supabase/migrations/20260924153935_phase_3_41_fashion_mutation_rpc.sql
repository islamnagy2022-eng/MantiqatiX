
create or replace function public.fashion_erp_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; v_owner uuid;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if;
 select response into v_existing from public.legacy_module_idempotency where module_code='FASHION_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if;
 v_owner:=coalesce(nullif(p_payload->>'owner_user_id','')::uuid,v_uid);
 if v_owner<>v_uid and not public.is_platform_admin() then raise exception 'forbidden'; end if;

 if p_action='create_product' then
  insert into public.fashion_products(id,owner_user_id,name,category_id,category_name,store_name,price,original_price,rating,review_count,image_url,description,available_sizes,available_colors,stock_count,is_best_seller,is_new_arrival,created_at,updated_at)
  values(p_payload->>'id',v_owner,p_payload->>'name',p_payload->>'category_id',p_payload->>'category_name',p_payload->>'store_name',(p_payload->>'price')::numeric,nullif(p_payload->>'original_price','')::numeric,coalesce((p_payload->>'rating')::numeric,0),coalesce((p_payload->>'review_count')::integer,0),coalesce(p_payload->>'image_url',''),coalesce(p_payload->>'description',''),coalesce(p_payload->'available_sizes','[]'::jsonb),coalesce(p_payload->'available_colors','[]'::jsonb),coalesce((p_payload->>'stock_count')::integer,0),coalesce((p_payload->>'is_best_seller')::boolean,false),coalesce((p_payload->>'is_new_arrival')::boolean,false),now(),now())
  returning to_jsonb(fashion_products.*) into v_result;
 elsif p_action='delete_product' then
  delete from public.fashion_products where id=p_payload->>'id' and owner_user_id=v_owner
  returning jsonb_build_object('id',id,'deleted',true) into v_result;
 elsif p_action='create_order' then
  insert into public.fashion_orders(order_id,owner_user_id,product_name,size,color,quantity,total_price,customer_name,phone,address,status,date_formatted,created_at,updated_at)
  values(p_payload->>'order_id',v_owner,p_payload->>'product_name',coalesce(p_payload->>'size',''),coalesce(p_payload->>'color',''),(p_payload->>'quantity')::integer,(p_payload->>'total_price')::numeric,p_payload->>'customer_name',p_payload->>'phone',p_payload->>'address',coalesce(p_payload->>'status','جاري التجهيز 🚚'),coalesce(p_payload->>'date_formatted','الآن'),now(),now())
  returning to_jsonb(fashion_orders.*) into v_result;
 elsif p_action='update_order_status' then
  update public.fashion_orders set status=p_payload->>'status',updated_at=now() where order_id=p_payload->>'order_id' and owner_user_id=v_owner
  returning jsonb_build_object('order_id',order_id,'status',status) into v_result;
 else raise exception 'unsupported fashion action'; end if;

 if v_result is null then raise exception 'target not found or mutation failed'; end if;
 insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response)
 values('FASHION_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')),v_result);
 return v_result;
end $$;
revoke all on function public.fashion_erp_mutate(text,jsonb,text) from public,anon;
grant execute on function public.fashion_erp_mutate(text,jsonb,text) to authenticated;
