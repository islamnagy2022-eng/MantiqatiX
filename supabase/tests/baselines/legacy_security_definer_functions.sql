-- TEST-ONLY LIVE-DERIVED FUNCTION BASELINE
-- Source: read-only pg_get_functiondef/pg_proc catalog snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-12.
-- This is NOT recovered historical creation DDL and MUST NOT be applied to production.
-- It is injected only into disposable CI replay at version 20260927074160 to allow later migration compatibility checks.
-- A passing replay with this fixture does NOT certify original historical function bodies or full production migration provenance.
-- No table rows are inserted, copied, updated, or deleted by this fixture.


-- Live catalog snapshot: public.counter_offer_indrive_bid(uuid,uuid,numeric)
CREATE OR REPLACE FUNCTION public.counter_offer_indrive_bid(p_request_id uuid, p_bid_id uuid, p_new_counter_price numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare uid uuid:=auth.uid(); begin if uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'authentication_required'; end if; if p_new_counter_price is null or p_new_counter_price < 0 then raise exception 'invalid_price'; end if; update public.indrive_bids b set offered_price=p_new_counter_price,note='مزايدة مضادة من العميل بـ '||round(p_new_counter_price)::text||' ج.م 🔄' where b.id=p_bid_id and b.request_id=p_request_id and exists(select 1 from public.indrive_requests r where r.id=b.request_id and r.owner_user_id=uid and r.status not in ('COMPLETED','CANCELLED')); if not found then raise exception 'bid_not_owned_or_request_not_editable'; end if; end $function$


-- Live catalog snapshot: public.fashion_erp_mutate(text,jsonb,text)
CREATE OR REPLACE FUNCTION public.fashion_erp_mutate(p_action text, p_payload jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record; begin if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if; if not public.is_platform_admin() and not exists(select 1 from public.user_memberships m where m.user_id=v_uid and m.status='ACTIVE' and upper(m.role) in ('BUSINESS_OWNER','OWNER','MANAGER','EMPLOYEE','STAFF','CASHIER')) then raise exception 'forbidden_business_role'; end if; if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if; select response into v_existing from public.legacy_module_idempotency where module_code='FASHION_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key; if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if; select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id','')); if p_action='create_product' then insert into public.fashion_products(id,owner_user_id,tenant_id,business_id,branch_id,name,category_id,category_name,store_name,price,original_price,rating,review_count,image_url,description,available_sizes,available_colors,stock_count,is_best_seller,is_new_arrival,created_at,updated_at) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'name',p_payload->>'category_id',p_payload->>'category_name',p_payload->>'store_name',(p_payload->>'price')::numeric,nullif(p_payload->>'original_price','')::numeric,coalesce((p_payload->>'rating')::numeric,0),coalesce((p_payload->>'review_count')::integer,0),coalesce(p_payload->>'image_url',''),coalesce(p_payload->>'description',''),coalesce(p_payload->'available_sizes','[]'::jsonb),coalesce(p_payload->'available_colors','[]'::jsonb),coalesce((p_payload->>'stock_count')::integer,0),coalesce((p_payload->>'is_best_seller')::boolean,false),coalesce((p_payload->>'is_new_arrival')::boolean,false),now(),now()) returning to_jsonb(fashion_products.*) into v_result; elsif p_action='delete_product' then delete from public.fashion_products where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result; elsif p_action='create_order' then insert into public.fashion_orders(order_id,owner_user_id,tenant_id,business_id,branch_id,product_name,size,color,quantity,total_price,customer_name,phone,address,status,date_formatted,created_at,updated_at) values(p_payload->>'order_id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'product_name',coalesce(p_payload->>'size',''),coalesce(p_payload->>'color',''),(p_payload->>'quantity')::integer,(p_payload->>'total_price')::numeric,p_payload->>'customer_name',p_payload->>'phone',p_payload->>'address',coalesce(p_payload->>'status','جاري التجهيز 🚚'),coalesce(p_payload->>'date_formatted','الآن'),now(),now()) returning to_jsonb(fashion_orders.*) into v_result; elsif p_action='update_order_status' then update public.fashion_orders set status=p_payload->>'status',updated_at=now() where order_id=p_payload->>'order_id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('order_id',order_id,'status',status) into v_result; else raise exception 'unsupported fashion action'; end if; if v_result is null then raise exception 'target not found or mutation failed'; end if; insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('FASHION_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result); return v_result; end $function$


-- Live catalog snapshot: public.mantigo_accept_bid(text,text)
CREATE OR REPLACE FUNCTION public.mantigo_accept_bid(p_ride_id text, p_bid_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (select 1 from public.mantigo_rides r where r.id = p_ride_id and r.customer_id = (select auth.uid()) and r.status = 'SEARCHING_BIDS') then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
  if not exists (select 1 from public.mantigo_bids b where b.id = p_bid_id and b.ride_id = p_ride_id) then raise exception 'BID_NOT_FOUND'; end if;
  update public.mantigo_rides set status = 'ACCEPTED', accepted_bid_id = p_bid_id, updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status = 'SEARCHING_BIDS';
  if not found then raise exception 'RIDE_STATE_CHANGED'; end if;
end; $function$


-- Live catalog snapshot: public.mantigo_cancel_ride(text)
CREATE OR REPLACE FUNCTION public.mantigo_cancel_ride(p_ride_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.mantigo_rides set status = 'CANCELLED', updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status not in ('COMPLETED','CANCELLED');
  if not found then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
end; $function$


-- Live catalog snapshot: public.mantigo_create_ride(text,text,text,text,numeric,text)
CREATE OR REPLACE FUNCTION public.mantigo_create_ride(p_vehicle_category text, p_ride_type text, p_pickup_location text, p_destination_location text, p_proposed_price numeric, p_note text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := (select auth.uid()); v_id text;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_pickup_location is null or btrim(p_pickup_location) = '' or p_destination_location is null or btrim(p_destination_location) = '' then raise exception 'INVALID_ROUTE'; end if;
  if p_proposed_price is null or p_proposed_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  v_id := 'ride_' || gen_random_uuid()::text;
  insert into public.mantigo_rides(id,customer_id,customer_name,customer_phone,vehicle_category,ride_type,pickup_location,destination_location,proposed_price,note,status)
  select v_id,v_uid,coalesce(u.raw_user_meta_data->>'full_name',''),coalesce(u.raw_user_meta_data->>'phone',''),p_vehicle_category,p_ride_type,btrim(p_pickup_location),btrim(p_destination_location),round(p_proposed_price,2),coalesce(p_note,''),'SEARCHING_BIDS'
  from auth.users u where u.id=v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_id;
end; $function$


-- Live catalog snapshot: public.mantigo_rate_ride(text,integer,text)
CREATE OR REPLACE FUNCTION public.mantigo_rate_ride(p_ride_id text, p_rating integer, p_comment text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid:=auth.uid(); v_captain uuid; v_rating_id uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  select b.captain_id into v_captain from public.mantigo_rides r join public.mantigo_bids b on b.id=r.accepted_bid_id where r.id=p_ride_id and r.customer_id=v_uid and r.status='COMPLETED';
  if v_captain is null then raise exception 'RIDE_NOT_COMPLETED_OR_NOT_OWNER'; end if;
  insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment)
  values(p_ride_id,v_uid,v_captain,p_rating,coalesce(p_comment,''))
  on conflict (ride_id,customer_id) do update set rating=excluded.rating,comment=excluded.comment
  returning id into v_rating_id;
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_RIDE_RATED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('rating',p_rating,'comment',coalesce(p_comment,'')),'SUCCESS');
  begin
    insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id)
    values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_captain,'MANTIGO_RATING','تقييم جديد','تم استلام تقييم جديد لرحلتك على MantiGO.','MANTIGO_RIDE',p_ride_id);
  exception when others then
    insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
    values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_RATING','error',sqlerrm),'PARTIAL');
  end;
  return v_rating_id;
end $function$


-- Live catalog snapshot: public.mantigo_submit_bid(text,numeric,text,text,text,text)
CREATE OR REPLACE FUNCTION public.mantigo_submit_bid(p_ride_id text, p_offered_price numeric, p_captain_name text DEFAULT ''::text, p_vehicle_category text DEFAULT 'MALAKI'::text, p_vehicle_model text DEFAULT ''::text, p_captain_message text DEFAULT ''::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := (select auth.uid()); v_id text; v_customer uuid;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_offered_price is null or p_offered_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  select customer_id into v_customer from public.mantigo_rides where id=p_ride_id and status='SEARCHING_BIDS';
  if v_customer is null then raise exception 'RIDE_NOT_FOUND_OR_CLOSED'; end if;
  if v_customer = v_uid then raise exception 'SELF_BID_NOT_ALLOWED'; end if;
  v_id := 'bid_' || gen_random_uuid()::text;
  insert into public.mantigo_bids(id,ride_id,captain_id,captain_name,captain_phone,vehicle_category,vehicle_model,offered_price,captain_message)
  select v_id,p_ride_id,v_uid,coalesce(nullif(btrim(p_captain_name),''),coalesce(u.raw_user_meta_data->>'full_name','')),coalesce(u.raw_user_meta_data->>'phone',''),p_vehicle_category,coalesce(p_vehicle_model,''),round(p_offered_price,2),coalesce(p_captain_message,'')
  from auth.users u where u.id=v_uid;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  return v_id;
end; $function$


-- Live catalog snapshot: public.mantigo_update_proposed_price(text,numeric)
CREATE OR REPLACE FUNCTION public.mantigo_update_proposed_price(p_ride_id text, p_new_price numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_new_price is null or p_new_price <= 0 then raise exception 'INVALID_PRICE'; end if;
  update public.mantigo_rides set proposed_price = round(p_new_price, 2), updated_at = now()
   where id = p_ride_id and customer_id = (select auth.uid()) and status = 'SEARCHING_BIDS';
  if not found then raise exception 'FORBIDDEN_OR_INVALID_RIDE_STATE'; end if;
end; $function$


-- Live catalog snapshot: public.restaurant_erp_mutate(text,jsonb,text)
CREATE OR REPLACE FUNCTION public.restaurant_erp_mutate(p_action text, p_payload jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record; begin if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if; if not public.is_platform_admin() and not exists(select 1 from public.user_memberships m where m.user_id=v_uid and m.status='ACTIVE' and upper(m.role) in ('BUSINESS_OWNER','OWNER','MANAGER','EMPLOYEE','STAFF','CASHIER')) then raise exception 'forbidden_business_role'; end if; if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if; select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_ERP' and actor_user_id=v_uid and idempotency_key=p_idempotency_key; if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if; select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id','')); if p_action='toggle_menu_availability' then update public.restaurant_menu_items set is_available=(p_payload->>'is_available')::boolean,updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_menu_items.*) into v_result; elsif p_action='delete_menu_item' then delete from public.restaurant_menu_items where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result; elsif p_action='create_menu_item' then insert into public.restaurant_menu_items(id,owner_user_id,tenant_id,business_id,branch_id,name_ar,description_ar,base_price_egp,original_price_egp,category,is_available,is_popular,created_at,updated_at) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'name_ar',coalesce(p_payload->>'description_ar',''),(p_payload->>'base_price_egp')::numeric,nullif(p_payload->>'original_price_egp','')::numeric,p_payload->>'category',coalesce((p_payload->>'is_available')::boolean,true),coalesce((p_payload->>'is_popular')::boolean,false),now(),now()) returning to_jsonb(restaurant_menu_items.*) into v_result; elsif p_action='create_order' then insert into public.restaurant_orders(id,owner_user_id,tenant_id,business_id,branch_id,customer_name,customer_phone,fulfillment_type,table_number,items,subtotal_egp,tax_egp,delivery_fee_egp,discount_egp,total_egp,status,notes_from_customer,delivery_pin_code,created_at,updated_at) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,p_payload->>'customer_name',p_payload->>'customer_phone',p_payload->>'fulfillment_type',nullif(p_payload->>'table_number','')::integer,coalesce(p_payload->'items','[]'::jsonb),(p_payload->>'subtotal_egp')::numeric,(p_payload->>'tax_egp')::numeric,(p_payload->>'delivery_fee_egp')::numeric,coalesce((p_payload->>'discount_egp')::numeric,0),(p_payload->>'total_egp')::numeric,coalesce(p_payload->>'status','NEW'),coalesce(p_payload->>'notes_from_customer',''),coalesce(p_payload->>'delivery_pin_code',''),now(),now()) returning to_jsonb(restaurant_orders.*) into v_result; elsif p_action='update_order_status' then update public.restaurant_orders set status=p_payload->>'status',driver_name=coalesce(p_payload->>'driver_name',driver_name),driver_phone=coalesce(p_payload->>'driver_phone',driver_phone),updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_orders.*) into v_result; elsif p_action='restock_inventory' then update public.restaurant_inventory set current_stock_qty=current_stock_qty+(p_payload->>'added_qty')::numeric,updated_at=now() where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'current_stock_qty',current_stock_qty) into v_result; else raise exception 'unsupported restaurant action'; end if; if v_result is null then raise exception 'target not found or mutation failed'; end if; insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('RESTAURANT_ERP',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result); return v_result; end $function$


-- Live catalog snapshot: public.restaurant_table_mutate(text,jsonb,text)
CREATE OR REPLACE FUNCTION public.restaurant_table_mutate(p_action text, p_payload jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v_uid uuid:=auth.uid(); v_result jsonb; v_existing jsonb; s record; begin if v_uid is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'unauthorized'; end if; if not public.is_platform_admin() and not exists(select 1 from public.user_memberships m where m.user_id=v_uid and m.status='ACTIVE' and upper(m.role) in ('BUSINESS_OWNER','OWNER','MANAGER','EMPLOYEE','STAFF','CASHIER')) then raise exception 'forbidden_business_role'; end if; if p_idempotency_key is null or length(p_idempotency_key)<8 or length(p_idempotency_key)>200 then raise exception 'invalid idempotency key'; end if; select response into v_existing from public.legacy_module_idempotency where module_code='RESTAURANT_TABLES' and actor_user_id=v_uid and idempotency_key=p_idempotency_key; if found then return coalesce(v_existing,'{"status":"ok"}'::jsonb); end if; select * into s from public.resolve_legacy_scope(nullif(p_payload->>'branch_id','')); if p_action='upsert_table' then insert into public.restaurant_tables(id,owner_user_id,tenant_id,business_id,branch_id,table_number,capacity_persons,status,current_active_order_id,current_bill_egp,reserved_customer_name) values(p_payload->>'id',v_uid,s.tenant_id,s.business_id,s.branch_id,(p_payload->>'table_number')::integer,(p_payload->>'capacity_persons')::integer,coalesce(p_payload->>'status','AVAILABLE'),nullif(p_payload->>'current_active_order_id',''),coalesce((p_payload->>'current_bill_egp')::numeric,0),nullif(p_payload->>'reserved_customer_name','')) on conflict(id) do update set table_number=excluded.table_number,capacity_persons=excluded.capacity_persons,status=excluded.status,current_active_order_id=excluded.current_active_order_id,current_bill_egp=excluded.current_bill_egp,reserved_customer_name=excluded.reserved_customer_name where restaurant_tables.tenant_id=s.tenant_id and restaurant_tables.business_id=s.business_id and restaurant_tables.branch_id=s.branch_id returning to_jsonb(restaurant_tables.*) into v_result; elsif p_action='update_status' then update public.restaurant_tables set status=p_payload->>'status',current_active_order_id=nullif(p_payload->>'current_active_order_id',''),current_bill_egp=coalesce((p_payload->>'current_bill_egp')::numeric,current_bill_egp),reserved_customer_name=nullif(p_payload->>'reserved_customer_name','') where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning to_jsonb(restaurant_tables.*) into v_result; elsif p_action='delete_table' then delete from public.restaurant_tables where id=p_payload->>'id' and tenant_id=s.tenant_id and business_id=s.business_id and branch_id=s.branch_id returning jsonb_build_object('id',id,'deleted',true) into v_result; else raise exception 'unsupported restaurant table action'; end if; if v_result is null then raise exception 'target not found or mutation failed'; end if; insert into public.legacy_module_idempotency(module_code,actor_user_id,idempotency_key,request_hash,response) values('RESTAURANT_TABLES',v_uid,md5(coalesce(p_action,'')||':'||coalesce(p_payload::text,'')||':'||s.branch_id),v_result); return v_result; end $function$

-- Reproduce observed client ACLs before subsequent hardening migrations.
REVOKE ALL ON FUNCTION public.counter_offer_indrive_bid(uuid,uuid,numeric) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fashion_erp_mutate(text,jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mantigo_accept_bid(text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mantigo_cancel_ride(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mantigo_create_ride(text,text,text,text,numeric,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mantigo_rate_ride(text,integer,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mantigo_submit_bid(text,numeric,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mantigo_update_proposed_price(text,numeric) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.restaurant_erp_mutate(text,jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.restaurant_table_mutate(text,jsonb,text) FROM PUBLIC, anon, authenticated, service_role;

-- Exact observed client-execution exception in the live catalog snapshot; a later committed hardening migration should revoke it.
GRANT EXECUTE ON FUNCTION public.mantigo_rate_ride(text,integer,text) TO authenticated;
