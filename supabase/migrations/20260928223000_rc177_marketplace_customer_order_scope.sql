-- RC177 marketplace customer cross-tenant order authorization
create or replace function public.create_order_backend(
 p_order_id uuid,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_customer_id uuid,
 p_client_idempotency_key varchar,p_subtotal numeric,p_discount numeric,p_tax numeric,p_delivery_fee numeric,
 p_total_amount numeric,p_currency varchar,p_customer_name text,p_customer_phone text,p_delivery_address text,
 p_items_json jsonb,p_notes text default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_existing orders; v_settings catalog_business_settings; v_currency varchar;
 v_subtotal numeric:=0; v_tax numeric:=0; v_total numeric:=0; v_delivery numeric:=0; v_discount numeric:=0;
 v_snapshot jsonb:='[]'; v_item jsonb; v_ci catalog_items; v_price catalog_item_prices;
 v_opt_total numeric; v_opt_count int; v_requested_opts int; v_qty numeric; v_line numeric; v_line_tax numeric;
 v_token text; v_hash text; v_pricing_version bigint:=0; v_customer_member boolean:=false;
begin
 if p_customer_id is null or auth.uid() is null or auth.uid()<>p_customer_id then raise exception 'CUSTOMER_REQUIRED'; end if;
 if p_tenant_id is null or p_tenant_id='' or p_business_id is null or p_client_idempotency_key is null or length(trim(p_client_idempotency_key))<8 then raise exception 'INVALID_ORDER_REQUEST'; end if;
 if p_items_json is null or jsonb_typeof(p_items_json)<>'array' or jsonb_array_length(p_items_json)=0 then raise exception 'INVALID_ITEMS'; end if;
 select exists(select 1 from user_memberships m where m.user_id=p_customer_id and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE') into v_customer_member;
 if not v_customer_member and not exists(select 1 from user_memberships m where m.user_id=p_customer_id and coalesce(m.status,'ACTIVE')='ACTIVE' and upper(m.role)='CUSTOMER') then raise exception 'CUSTOMER_MEMBERSHIP_REQUIRED'; end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and coalesce(b.status,'ACTIVE')='ACTIVE') then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if not exists(select 1 from marketing_provider_profiles pp where pp.business_id=p_business_id and pp.status='ACTIVE') then raise exception 'PROVIDER_NOT_AVAILABLE'; end if;
 if p_branch_id is not null and not exists(select 1 from branches br where br.id=p_branch_id and br.business_id=p_business_id and br.tenant_id=p_tenant_id and coalesce(br.status,'ACTIVE')='ACTIVE') then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
 select * into v_existing from orders where tenant_id=p_tenant_id and client_idempotency_key=trim(p_client_idempotency_key) for update;
 if found then return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'total_amount',v_existing.total_amount,'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,'pricing_hash',v_existing.pricing_hash,'pricing_snapshot',v_existing.pricing_snapshot,'idempotent',true); end if;
 select * into v_settings from catalog_business_settings where business_id=p_business_id;
 if not found then insert into catalog_business_settings(business_id,tenant_id) values(p_business_id,p_tenant_id) on conflict (business_id) do nothing; select * into v_settings from catalog_business_settings where business_id=p_business_id; end if;
 v_currency:=upper(coalesce(v_settings.currency,p_currency,'EGP')); v_delivery:=v_settings.delivery_fee;
 for v_item in select value from jsonb_array_elements(p_items_json) loop
   v_token:=coalesce(nullif(v_item->>'catalogItemId',''),nullif(v_item->>'productId','')); if v_token is null then raise exception 'CATALOG_ITEM_REQUIRED'; end if;
   select * into v_ci from catalog_items ci where ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE' and (ci.id::text=v_token or ci.legacy_ref=v_token) and (ci.branch_id is null or ci.branch_id=p_branch_id) order by (ci.branch_id is not null) desc limit 1;
   if not found then raise exception 'CATALOG_ITEM_NOT_FOUND:%',v_token; end if;
   v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,0); if v_qty<=0 or v_qty>10000 then raise exception 'INVALID_QUANTITY'; end if;
   select * into v_price from catalog_item_prices cp where cp.catalog_item_id=v_ci.id and cp.tenant_id=p_tenant_id and cp.status='ACTIVE' and cp.effective_from<=now() and (cp.effective_to is null or cp.effective_to>now()) and (cp.branch_id is null or cp.branch_id=p_branch_id) order by (cp.branch_id is not null) desc,cp.effective_from desc,cp.version desc limit 1;
   if not found then raise exception 'CATALOG_PRICE_NOT_FOUND:%',v_ci.id; end if;
   select coalesce(sum(o.price_delta),0),count(o.id) into v_opt_total,v_opt_count from catalog_item_options o where o.catalog_item_id=v_ci.id and o.status='ACTIVE' and o.id::text in (select jsonb_array_elements_text(coalesce(v_item->'selectedOptionIds','[]'::jsonb)));
   v_requested_opts:=jsonb_array_length(coalesce(v_item->'selectedOptionIds','[]'::jsonb)); if v_opt_count<>v_requested_opts then raise exception 'INVALID_ITEM_OPTIONS'; end if;
   v_line:=round((v_price.unit_price+v_opt_total)*v_qty,2); v_line_tax:=case when v_settings.tax_inclusive then 0 else round(v_line*v_ci.tax_rate/100,2) end;
   v_subtotal:=v_subtotal+v_line; v_tax:=v_tax+v_line_tax; v_pricing_version:=greatest(v_pricing_version,v_price.version);
   v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object('catalog_item_id',v_ci.id,'legacy_ref',v_ci.legacy_ref,'name_ar',v_ci.name_ar,'quantity',v_qty,'unit_price',v_price.unit_price,'option_total',v_opt_total,'tax_rate',v_ci.tax_rate,'line_subtotal',v_line,'line_tax',v_line_tax,'price_version',v_price.version,'price_effective_from',v_price.effective_from,'branch_id',v_price.branch_id));
 end loop;
 v_total:=round(v_subtotal-v_discount+v_tax+v_delivery,2);
 v_hash:=encode(digest(v_snapshot::text||'|'||v_currency||'|'||v_total::text||'|'||v_delivery::text||'|'||v_tax::text||'|'||v_discount::text,'sha256'),'hex');
 insert into orders(id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,currency,customer_name,customer_phone,delivery_address,items_json,notes,metadata,client_idempotency_key,pricing_version,pricing_snapshot,pricing_hash,pricing_authority)
 values(p_order_id,p_tenant_id,p_business_id,p_branch_id,p_customer_id,'PENDING',v_subtotal,v_discount,v_tax,v_delivery,v_total,v_currency,p_customer_name,p_customer_phone,p_delivery_address,v_snapshot,p_notes,coalesce(p_metadata,'{}')||jsonb_build_object('pricing_server_authoritative',true),trim(p_client_idempotency_key),v_pricing_version,v_snapshot,v_hash,'catalog_v1');
 return jsonb_build_object('id',p_order_id,'status','PENDING','subtotal',v_subtotal,'discount',v_discount,'tax',v_tax,'delivery_fee',v_delivery,'total_amount',v_total,'currency',v_currency,'pricing_version',v_pricing_version,'pricing_hash',v_hash,'pricing_snapshot',v_snapshot,'idempotent',false);
end $$;