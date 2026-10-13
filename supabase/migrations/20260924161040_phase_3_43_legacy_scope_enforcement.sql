create or replace function public.resolve_legacy_scope(p_branch_id text default null)
returns table(tenant_id varchar,business_id uuid,branch_id varchar)
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_branch text; v_count int;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_branch_id is not null and length(trim(p_branch_id))>0 then
   select b.tenant_id,b.business_id,b.id into tenant_id,business_id,branch_id
   from public.branches b
   where b.id=trim(p_branch_id) and b.status='ACTIVE'
     and (public.is_platform_admin() or exists(
       select 1 from public.user_memberships m
       where m.user_id=v_uid and m.branch_id=b.id and m.tenant_id=b.tenant_id
         and m.business_id=b.business_id and m.status='ACTIVE'
     ));
   if branch_id is null then raise exception 'forbidden_branch'; end if;
   return next; return;
 end if;
 if public.is_platform_admin() then raise exception 'branch_context_required'; end if;
 select count(distinct m.branch_id) into v_count
 from public.user_memberships m
 where m.user_id=v_uid and m.status='ACTIVE' and m.branch_id is not null;
 if v_count <> 1 then raise exception 'branch_context_required'; end if;
 select b.tenant_id,b.business_id,b.id into tenant_id,business_id,branch_id
 from public.branches b
 join public.user_memberships m on m.branch_id=b.id
 where m.user_id=v_uid and m.status='ACTIVE' and b.status='ACTIVE'
 limit 1;
 if branch_id is null then raise exception 'forbidden_branch'; end if;
 return next;
end $$;
revoke all on function public.resolve_legacy_scope(text) from public,anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['restaurant_menu_items','restaurant_orders','restaurant_inventory','restaurant_tables','fashion_products','fashion_orders'] loop
   execute format('drop policy if exists legacy_scope_boundary on public.%I',t);
   execute format('create policy legacy_scope_boundary on public.%I as restrictive for all to authenticated using ((public.is_platform_admin()) or exists (select 1 from public.user_memberships m where m.user_id=(select auth.uid()) and m.status=''ACTIVE'' and m.tenant_id=%I.tenant_id and m.business_id=%I.business_id and m.branch_id=%I.branch_id)) with check ((public.is_platform_admin()) or exists (select 1 from public.user_memberships m where m.user_id=(select auth.uid()) and m.status=''ACTIVE'' and m.tenant_id=%I.tenant_id and m.business_id=%I.business_id and m.branch_id=%I.branch_id))',t,t,t,t,t,t,t);
 end loop;
end $$;

create or replace function public.restaurant_erp_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if;
 select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if;
 select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id',''));
 if p_action='toggle_menu_availability' then
   update public.restaurant_menu_items set is_available=(p_payload->>'is_available')::boolean,updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_menu_items.*) into v_result;
 elsif p_action='delete_menu_item' then
   delete from public.restaurant_menu_items where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result;
 elsif p_action='create_menu_item' then
   insert into public.restaurant_menu_items(id,owner_user_id,tenant_id,business_id,branch_id,name_ar,description_ar,base_price_egp,original_price_egp,category,is_available,is_popular,created_at,updated_at)
   values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'name_ar',coalesce(p_payload->>'description_ar',''),(p_payload->>'base_price_egp')::numeric,nullif(p_payload->>'original_price_egp','')::numeric,p_payload->>'category',coalesce((p_payload->>'is_available')::boolean,true),coalesce((p_payload->>'is_popular')::boolean,false),now(),now())
   returning to_jsonb(restaurant_menu_items.*) into v_result;
 elsif p_action='create_order' then
   insert into public.restaurant_orders(id,owner_user_id,tenant_id,business_id,branch_id,customer_name,customer_phone,fulfillment_type,table_number,items,subtotal_egp,tax_egp,delivery_fee_egp,discount_egp,total_egp,status,notes_from_customer,delivery_pin_code,created_at,updated_at)
   values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'customer_name',p_payload->>'customer_phone',p_payload->>'fulfillment_type',nullif(p_payload->>'table_number','')::integer,coalesce(p_payload->'items','[]'::jsonb),(p_payload->>'subtotal_egp')::numeric,(p_payload->>'tax_egp')::numeric,(p_payload->>'delivery_fee_egp')::numeric,coalesce((p_payload->>'discount_egp')::numeric,0),(p_payload->>'total_egp')::numeric,coalesce(p_payload->>'status','NEW'),coalesce(p_payload->>'notes_from_customer',''),coalesce(p_payload->>'delivery_pin_code',''),now(),now())
   returning to_jsonb(restaurant_orders.*) into v_result;
 elsif p_action='restock_inventory' then
   update public.restaurant_inventory set current_stock_qty=current_stock_qty+(p_payload->>'added_qty')::numeric,updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'current_stock_qty',current_stock_qty) into v_result;
 else raise exception 'unsupported restaurant action'; end if;
 if v_result is null then raise exception 'target not found or mutation failed'; end if;
 insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('RESTAURANT_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result);
 return v_result;
end $$;

create or replace function public.restaurant_table_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if;
 select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_TABLES' and actor_user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if;
 select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id',''));
 if p_action='upsert_table' then
   insert into public.restaurant_tables(id,owner_user_id,tenant_id,business_id,branch_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name)
   values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,(p_payload->>'table_number')::integer,(p_payload->>'capacity_persons')::integer,coalesce(p_payload->>'status','AVAILABLE'),nullif(p_payload->>'current_active_order_id',''),coalesce((p_payload->>'current_bill_egp')::numeric,0),nullif(p_payload->>'reserved_customer_name',''))
   on conflict(id) do update set table_number=excluded.table_number,capacity_persons=excluded.capacity_persons,status=excluded.status,current_active_order_id=excluded.current_active_order_id,current_bill_egp=excluded.current_bill_egp,reserved_customer_name=excluded.reserved_customer_name
   where restaurant_tables.tenant_id=s.tenant_id and restaurant_tables.business_id=s.business_id and restaurant_tables.branch_id=s.branch_id
   returning to_jsonb(restaurant_tables.*) into v_result;
 elsif p_action='update_status' then
   update public.restaurant_tables set status=p_payload->>'status',current_active_order_id=nullif(p_payload->>'current_active_order_id',''),current_bill_egp=coalesce((p_payload->>'current_bill_egp')::numeric,current_bill_egp),reserved_customer_name=nullif(p_payload->>'reserved_customer_name','')
   where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_tables.*) into v_result;
 elsif p_action='delete_table' then
   delete from public.restaurant_tables where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result;
 else raise exception 'unsupported restaurant table action'; end if;
 if v_result is null then raise exception 'target not found or mutation failed'; end if;
 insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('RESTAURANT_TABLES',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result);
 return v_result;
end $$;

create or replace function public.fashion_erp_mutate(p_action text,p_payload jsonb,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if;
 if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if;
 select response into v_existing from public.legacy_module_idempotency where module_code='FASHION_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key;
 if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if;
 select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id',''));
 if p_action='create_product' then
  insert into public.fashion_products(id,owner_user_id,tenant_id,business_id,branch_id,name,category_id,category_name,store_name,price,original_price,rating,review_count,image_url,description,available_sizes,available_colors,stock_count,is_best_seller,is_new_arrival,created_at,updated_at)
  values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'name',p_payload->>'category_id',p_payload->>'category_name',p_payload->>'store_name',(p_payload->>'price')::numeric,nullif(p_payload->>'original_price','')::numeric,coalesce((p_payload->>'rating')::numeric,0),coalesce((p_payload->>'review_count')::integer,0),coalesce(p_payload->>'image_url',''),coalesce(p_payload->>'description',''),coalesce(p_payload->'available_sizes','[]'::jsonb),coalesce(p_payload->'available_colors','[]'::jsonb),coalesce((p_payload->>'stock_count')::integer,0),coalesce((p_payload->>'is_best_seller')::boolean,false),coalesce((p_payload->>'is_new_arrival')::boolean,false),now(),now())
  returning to_jsonb(fashion_products.*) into v_result;
 elsif p_action='delete_product' then
  delete from public.fashion_products where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result;
 elsif p_action='create_order' then
  insert into public.fashion_orders(order_id,owner_user_id,tenant_id,business_id,branch_id,product_name,size,color,quantity,total_price,customer_name,phone,address,status,date_formatted,created_at,updated_at)
  values(p_payload->>'order_id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'product_name',coalesce(p_payload->>'size',''),coalesce(p_payload->>'color',''),(p_payload->>'quantity')::integer,(p_payload->>'total_price')::numeric,p_payload->>'customer_name',p_payload->>'phone',p_payload->>'address',coalesce(p_payload->>'status','جاري التجهيز 🚚'),coalesce(p_payload->>'date_formatted','الآن'),now(),now())
  returning to_jsonb(fashion_orders.*) into v_result;
 elsif p_action='update_order_status' then
  update public.fashion_orders set status=p_payload->>'status',updated_at=now() where order_id=p_payload->>'order_id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('order_id',order_id,'status',status) into v_result;
 else raise exception 'unsupported fashion action'; end if;
 if v_result is null then raise exception 'target not found or mutation failed'; end if;
 insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('FASHION_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result);
 return v_result;
end $$;
revoke all on function public.restaurant_erp_mutate(text,jsonb,text), public.restaurant_table_mutate(text,jsonb,text), public.fashion_erp_mutate(text,jsonb,text) from public,anon;
grant execute on function public.restaurant_erp_mutate(text,jsonb,text), public.restaurant_table_mutate(text,jsonb,text), public.fashion_erp_mutate(text,jsonb,text) to authenticated;
