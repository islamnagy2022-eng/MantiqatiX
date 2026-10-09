-- Catalog Edge Function service-role execution boundary.
-- The catalog-admin Edge Function verifies the bearer user, action-specific RBAC,
-- tenant/business/branch membership and active branch before calling these RPCs.
-- Direct API execution remains revoked from anon/authenticated/public.
-- Service-role execution is permitted only to trusted backend code.

create or replace function public.upsert_catalog_item_backend(
  p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_legacy_ref varchar,p_item_type varchar,p_name_ar text,p_name_en text,p_description text,p_sku varchar,p_tax_rate numeric,p_metadata jsonb,p_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid; v_existing_branch varchar;
begin
 if coalesce(auth.role(),'') <> 'service_role' then
   if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
   if not exists(select 1 from user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and m.status='ACTIVE' and (upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER') or (upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if p_tax_rate is null or p_tax_rate<0 or p_tax_rate>100 or nullif(trim(p_name_ar),'') is null then raise exception 'INVALID_CATALOG_ITEM'; end if;
 if p_branch_id is not null and not exists(select 1 from branches b where b.id::text=p_branch_id and b.tenant_id=p_tenant_id and b.business_id=p_business_id and upper(coalesce(b.status,''))='ACTIVE') then raise exception 'BRANCH_NOT_AVAILABLE'; end if;
 if p_id is null then
   insert into catalog_items(tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,description,sku,tax_rate,metadata)
   values(p_tenant_id,p_business_id,p_branch_id,nullif(trim(p_legacy_ref),''),upper(coalesce(p_item_type,'PRODUCT')),trim(p_name_ar),p_name_en,p_description,p_sku,p_tax_rate,coalesce(p_metadata,'{}'))
   returning id into v_id;
 else
   select ci.branch_id into v_existing_branch from catalog_items ci
    where ci.id=p_id and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id for update;
   if not found then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if;
   if v_existing_branch is distinct from p_branch_id then raise exception 'CATALOG_BRANCH_SCOPE_IMMUTABLE'; end if;
   update catalog_items set legacy_ref=nullif(trim(p_legacy_ref),''),item_type=upper(coalesce(p_item_type,item_type)),name_ar=trim(p_name_ar),name_en=p_name_en,description=p_description,sku=p_sku,tax_rate=p_tax_rate,metadata=coalesce(p_metadata,metadata),updated_at=now()
   where id=p_id and tenant_id=p_tenant_id and business_id=p_business_id returning id into v_id;
 end if;
 return jsonb_build_object('id',v_id);
end $function$;

create or replace function public.upsert_catalog_price_backend(
 p_tenant_id varchar,p_business_id uuid,p_catalog_item_id uuid,p_branch_id varchar,p_currency varchar,p_unit_price numeric,p_effective_from timestamptz default now(),p_effective_to timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_id uuid; v_version bigint; v_item_branch varchar;
begin
 if coalesce(auth.role(),'') <> 'service_role' then
   if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
   if not exists(select 1 from user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and m.status='ACTIVE' and (upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER') or (upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 end if;
 select ci.branch_id into v_item_branch from catalog_items ci
  where ci.id=p_catalog_item_id and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id for update;
 if not found then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if;
 if v_item_branch is not null and v_item_branch is distinct from p_branch_id then raise exception 'CATALOG_BRANCH_SCOPE_MISMATCH'; end if;
 if p_unit_price is null or p_unit_price<0 then raise exception 'INVALID_PRICE'; end if;
 if upper(trim(coalesce(p_currency,'EGP'))) <> 'EGP' then raise exception 'UNSUPPORTED_CURRENCY'; end if;
 if p_effective_to is not null and p_effective_to<=coalesce(p_effective_from,now()) then raise exception 'INVALID_PRICE_EFFECTIVITY'; end if;
 if p_branch_id is not null and not exists(select 1 from branches b where b.id::text=p_branch_id and b.tenant_id=p_tenant_id and b.business_id=p_business_id and upper(coalesce(b.status,''))='ACTIVE') then raise exception 'BRANCH_NOT_AVAILABLE'; end if;
 select coalesce(max(version),0)+1 into v_version from catalog_item_prices where catalog_item_id=p_catalog_item_id and coalesce(branch_id,'')=coalesce(p_branch_id,'');
 insert into catalog_item_prices(tenant_id,catalog_item_id,branch_id,currency,unit_price,version,effective_from,effective_to)
 values(p_tenant_id,p_catalog_item_id,p_branch_id,upper(trim(coalesce(p_currency,'EGP'))),p_unit_price,v_version,coalesce(p_effective_from,now()),p_effective_to)
 returning id into v_id;
 return jsonb_build_object('id',v_id,'version',v_version);
end $function$;

create or replace function public.upsert_catalog_settings_backend(
 p_tenant_id varchar,p_business_id uuid,p_currency varchar default 'EGP',p_delivery_fee numeric default 0,p_tax_inclusive boolean default false,p_allow_discounts boolean default false
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=auth.uid(); v_role text; v_row public.catalog_business_settings%rowtype;
begin
 if coalesce(auth.role(),'') <> 'service_role' then
   if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then raise exception 'UNAUTHENTICATED'; end if;
   select upper(m.role::text) into v_role from public.user_memberships m where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE' and (m.business_id=p_business_id or m.business_id is null) order by case upper(m.role::text) when 'SUPER_ADMIN' then 0 when 'OWNER' then 1 when 'ADMIN' then 2 when 'BUSINESS_OWNER' then 3 when 'MANAGER' then 4 else 99 end limit 1;
   if v_role is null or v_role not in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SUPER_ADMIN') then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
   if v_role='SUPER_ADMIN' and not exists(select 1 from user_memberships m where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 end if;
 if not exists(select 1 from public.businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if p_currency is null or upper(trim(p_currency)) <> 'EGP' then raise exception 'UNSUPPORTED_CURRENCY'; end if;
 if p_delivery_fee is null or p_delivery_fee<0 then raise exception 'INVALID_DELIVERY_FEE'; end if;
 insert into public.catalog_business_settings(business_id,tenant_id,currency,delivery_fee,tax_inclusive,allow_discounts,updated_at)
 values(p_business_id,p_tenant_id,upper(trim(p_currency)),p_delivery_fee,p_tax_inclusive,p_allow_discounts,now())
 on conflict(business_id) do update set tenant_id=excluded.tenant_id,currency=excluded.currency,delivery_fee=excluded.delivery_fee,tax_inclusive=excluded.tax_inclusive,allow_discounts=excluded.allow_discounts,updated_at=now()
 returning * into v_row;
 return to_jsonb(v_row);
end $function$;

revoke all on function public.upsert_catalog_item_backend(varchar,uuid,varchar,varchar,varchar,text,text,text,varchar,numeric,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.upsert_catalog_price_backend(varchar,uuid,uuid,varchar,varchar,numeric,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.upsert_catalog_settings_backend(varchar,uuid,varchar,numeric,boolean,boolean) from public, anon, authenticated;
grant execute on function public.upsert_catalog_item_backend(varchar,uuid,varchar,varchar,varchar,text,text,text,varchar,numeric,jsonb,uuid) to service_role;
grant execute on function public.upsert_catalog_price_backend(varchar,uuid,uuid,varchar,varchar,numeric,timestamptz,timestamptz) to service_role;
grant execute on function public.upsert_catalog_settings_backend(varchar,uuid,varchar,numeric,boolean,boolean) to service_role;

-- The Edge Function authenticates the bearer token and supplies the verified user ID.
-- Keep create_order_backend service-role-only; preserve server-side membership, provider,
-- branch, catalog, price and option validation. Scope idempotency keys to the same actor/business.
create or replace function public.create_order_backend(
 p_order_id uuid,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_customer_id uuid,p_client_idempotency_key varchar,
 p_subtotal numeric,p_discount numeric,p_tax numeric,p_delivery_fee numeric,p_total_amount numeric,p_currency varchar,
 p_customer_name text,p_customer_phone text,p_delivery_address text,p_items_json jsonb,p_notes text default null,p_metadata jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
 v_existing orders;
 v_settings catalog_business_settings;
 v_currency varchar;
 v_subtotal numeric:=0;
 v_tax numeric:=0;
 v_total numeric:=0;
 v_delivery numeric:=0;
 v_discount numeric:=0;
 v_snapshot jsonb:='[]';
 v_item jsonb;
 v_ci catalog_items;
 v_price catalog_item_prices;
 v_opt_total numeric;
 v_opt_count int;
 v_requested_opts int;
 v_qty numeric;
 v_line numeric;
 v_line_tax numeric;
 v_token text;
 v_hash text;
 v_pricing_version bigint:=0;
 v_authorized_membership boolean:=false;
 v_request_items jsonb:='[]'::jsonb;
 v_request_hash text;
 v_inserted_id uuid;
begin
 if p_customer_id is null then raise exception 'CUSTOMER_REQUIRED'; end if;
 if coalesce(auth.role(),'') <> 'service_role' and (auth.uid() is null or auth.uid()<>p_customer_id) then raise exception 'CUSTOMER_REQUIRED'; end if;
 if p_tenant_id is null or p_tenant_id='' or p_business_id is null or p_client_idempotency_key is null or length(trim(p_client_idempotency_key))<8 or length(trim(p_client_idempotency_key))>200 then raise exception 'INVALID_ORDER_REQUEST'; end if;
 if upper(trim(coalesce(p_currency,'EGP'))) <> 'EGP' then raise exception 'UNSUPPORTED_CURRENCY'; end if;
 if p_items_json is null or jsonb_typeof(p_items_json)<>'array' then raise exception 'INVALID_ITEMS'; end if;
 if jsonb_array_length(p_items_json)=0 or jsonb_array_length(p_items_json)>100 then raise exception 'INVALID_ITEMS'; end if;
 if nullif(trim(coalesce(p_customer_name,'')),'') is null or length(trim(p_customer_name))>200 then raise exception 'INVALID_CUSTOMER_NAME'; end if;
 if length(regexp_replace(coalesce(p_customer_phone,''),'[^0-9]','','g'))<7 or length(regexp_replace(coalesce(p_customer_phone,''),'[^0-9]','','g'))>15 then raise exception 'INVALID_CUSTOMER_PHONE'; end if;
 if upper(coalesce(p_metadata->>'order_type','DELIVERY')) not in ('DELIVERY','TAKEAWAY') then raise exception 'INVALID_ORDER_TYPE'; end if;
 if upper(coalesce(p_metadata->>'order_type','DELIVERY'))='DELIVERY' and nullif(trim(coalesce(p_delivery_address,'')),'') is null then raise exception 'DELIVERY_ADDRESS_REQUIRED'; end if;
 select exists(
   select 1 from user_memberships m
   where m.user_id=p_customer_id
     and m.status='ACTIVE'
     and (
       upper(m.role)='CUSTOMER'
       or (
         m.tenant_id=p_tenant_id
         and (
           (upper(m.role)='OWNER' and (m.business_id is null or m.business_id=p_business_id))
           or (upper(m.role) in ('BUSINESS_OWNER','ADMIN','MANAGER','SALES') and m.business_id=p_business_id)
         )
         and (m.branch_id is null or m.branch_id=p_branch_id)
       )
       or (
         m.tenant_id=p_tenant_id and upper(m.role)='SUPER_ADMIN'
         and coalesce(m.permissions->>'scope','')='PLATFORM'
         and coalesce((m.permissions->>'full_control')::boolean,false)=true
       )
     )
 ) into v_authorized_membership;
 if not v_authorized_membership then raise exception 'CUSTOMER_MEMBERSHIP_REQUIRED'; end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and coalesce(b.status,'ACTIVE')='ACTIVE') then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if not exists(select 1 from marketing_provider_profiles pp where pp.business_id=p_business_id and pp.status='ACTIVE') then raise exception 'PROVIDER_NOT_AVAILABLE'; end if;
 if p_branch_id is not null and not exists(select 1 from branches br where br.id::text=p_branch_id and br.business_id=p_business_id and br.tenant_id=p_tenant_id and coalesce(br.status,'ACTIVE')='ACTIVE') then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'catalogItemId',coalesce(x.value->>'catalogItemId',x.value->>'productId'),
   'quantity',x.value->'quantity',
   'selectedOptionIds',coalesce(x.value->'selectedOptionIds','[]'::jsonb)
 ) order by x.ordinality),'[]'::jsonb)
 into v_request_items
 from jsonb_array_elements(p_items_json) with ordinality as x(value,ordinality);
 v_request_hash:=encode(digest(jsonb_build_object(
   'items',v_request_items,
   'order_type',upper(coalesce(p_metadata->>'order_type','DELIVERY')),
   'customer_name',trim(p_customer_name),
   'customer_phone',trim(p_customer_phone),
   'delivery_address',trim(coalesce(p_delivery_address,'')),
   'notes',coalesce(p_notes,'')
 )::text,'sha256'),'hex');
 select * into v_existing from orders where tenant_id=p_tenant_id and client_idempotency_key=trim(p_client_idempotency_key) for update;
 if found then
   if v_existing.customer_id is distinct from p_customer_id or v_existing.business_id is distinct from p_business_id or coalesce(v_existing.branch_id,'')<>coalesce(p_branch_id,'') then
     raise exception 'IDEMPOTENCY_KEY_SCOPE_CONFLICT';
   end if;
   if nullif(v_existing.metadata->>'request_hash','') is null then raise exception 'IDEMPOTENCY_LEGACY_PAYLOAD_UNVERIFIABLE'; end if;
   if v_existing.metadata->>'request_hash' is distinct from v_request_hash then raise exception 'IDEMPOTENCY_PAYLOAD_CONFLICT'; end if;
   return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'total_amount',v_existing.total_amount,'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,'pricing_hash',v_existing.pricing_hash,'pricing_snapshot',v_existing.pricing_snapshot,'idempotent',true);
 end if;
 select * into v_settings from catalog_business_settings where business_id=p_business_id and tenant_id=p_tenant_id;
 if not found then
   if exists(select 1 from catalog_business_settings where business_id=p_business_id) then
     raise exception 'BUSINESS_SETTINGS_TENANT_MISMATCH';
   end if;
   insert into catalog_business_settings(business_id,tenant_id) values(p_business_id,p_tenant_id) on conflict (business_id) do nothing;
   select * into v_settings from catalog_business_settings where business_id=p_business_id and tenant_id=p_tenant_id;
   if not found then raise exception 'BUSINESS_SETTINGS_UNAVAILABLE'; end if;
 end if;
 v_currency:=upper(trim(coalesce(nullif(trim(v_settings.currency),''),p_currency,'EGP')));
 if v_currency <> 'EGP' then raise exception 'UNSUPPORTED_CURRENCY'; end if;
 if upper(coalesce(p_metadata->>'order_type','DELIVERY'))='DELIVERY' then
   v_delivery:=coalesce(v_settings.delivery_fee,0);
   if v_delivery<0 then raise exception 'INVALID_DELIVERY_FEE'; end if;
 else
   v_delivery:=0;
 end if;
 if upper(coalesce(p_metadata->>'order_type','DELIVERY')) not in ('DELIVERY','TAKEAWAY') then raise exception 'INVALID_ORDER_TYPE'; end if;
 for v_item in select value from jsonb_array_elements(p_items_json) loop
   if jsonb_typeof(coalesce(v_item->'selectedOptionIds','[]'::jsonb)) <> 'array' then raise exception 'INVALID_ITEM_OPTIONS'; end if;
   v_token:=coalesce(nullif(v_item->>'catalogItemId',''),nullif(v_item->>'productId',''));
   if v_token is null then raise exception 'CATALOG_ITEM_REQUIRED'; end if;
   select * into v_ci from catalog_items ci
    where ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE'
      and lower(coalesce(ci.metadata->>'is_available','true')) <> 'false'
      and (ci.id::text=v_token or ci.legacy_ref=v_token)
      and (ci.branch_id is null or ci.branch_id=p_branch_id)
    order by (ci.branch_id is not null) desc limit 1;
   if not found then raise exception 'CATALOG_ITEM_NOT_FOUND:%',v_token; end if;
   if v_ci.tax_rate is null or v_ci.tax_rate<0 or v_ci.tax_rate>100 then raise exception 'INVALID_CATALOG_TAX_RATE'; end if;
   v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,0);
   if v_qty<=0 or v_qty>1000 or v_qty<>trunc(v_qty) then raise exception 'INVALID_QUANTITY'; end if;
   select * into v_price from catalog_item_prices cp
    where cp.catalog_item_id=v_ci.id and cp.tenant_id=p_tenant_id and cp.status='ACTIVE'
      and cp.effective_from<=now() and (cp.effective_to is null or cp.effective_to>now())
      and (cp.branch_id is null or cp.branch_id=p_branch_id)
    order by (cp.branch_id is not null) desc,cp.effective_from desc,cp.version desc limit 1;
   if not found then raise exception 'CATALOG_PRICE_NOT_FOUND:%',v_ci.id; end if;
   if v_price.unit_price is null or v_price.unit_price<0 then raise exception 'INVALID_CATALOG_PRICE'; end if;
   select coalesce(sum(o.price_delta),0),count(o.id) into v_opt_total,v_opt_count
    from catalog_item_options o where o.catalog_item_id=v_ci.id and o.tenant_id=p_tenant_id and o.status='ACTIVE'
      and o.id::text in (select jsonb_array_elements_text(coalesce(v_item->'selectedOptionIds','[]'::jsonb)));
   v_requested_opts:=jsonb_array_length(coalesce(v_item->'selectedOptionIds','[]'::jsonb));
   if v_opt_count<>v_requested_opts or (v_price.unit_price+v_opt_total)<0 then raise exception 'INVALID_ITEM_OPTIONS'; end if;
   v_line:=round((v_price.unit_price+v_opt_total)*v_qty,2);
   v_line_tax:=case when coalesce(v_settings.tax_inclusive,false) then 0 else round(v_line*v_ci.tax_rate/100,2) end;
   v_subtotal:=v_subtotal+v_line;
   v_tax:=v_tax+v_line_tax;
   v_pricing_version:=greatest(v_pricing_version,v_price.version);
   v_snapshot:=v_snapshot||jsonb_build_array(jsonb_build_object('catalog_item_id',v_ci.id,'legacy_ref',v_ci.legacy_ref,'name_ar',v_ci.name_ar,'quantity',v_qty,'unit_price',v_price.unit_price,'option_total',v_opt_total,'tax_rate',v_ci.tax_rate,'line_subtotal',v_line,'line_tax',v_line_tax,'price_version',v_price.version,'price_effective_from',v_price.effective_from,'branch_id',v_price.branch_id));
 end loop;
 v_total:=round(v_subtotal-v_discount+v_tax+v_delivery,2);
 v_hash:=encode(digest(v_snapshot::text||'|'||v_currency||'|'||v_total::text||'|'||v_delivery::text||'|'||v_tax::text||'|'||v_discount::text,'sha256'),'hex');
 insert into orders(id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,currency,customer_name,customer_phone,delivery_address,items_json,notes,metadata,client_idempotency_key,pricing_version,pricing_snapshot,pricing_hash,pricing_authority)
 values(p_order_id,p_tenant_id,p_business_id,p_branch_id,p_customer_id,'PENDING',v_subtotal,v_discount,v_tax,v_delivery,v_total,v_currency,p_customer_name,p_customer_phone,p_delivery_address,v_snapshot,p_notes,coalesce(p_metadata,'{}')||jsonb_build_object('pricing_server_authoritative',true,'request_hash',v_request_hash),trim(p_client_idempotency_key),v_pricing_version,v_snapshot,v_hash,'catalog_v1')
 on conflict (tenant_id,client_idempotency_key) where client_idempotency_key is not null do nothing
 returning id into v_inserted_id;
 if v_inserted_id is null then
   select * into v_existing from orders where tenant_id=p_tenant_id and client_idempotency_key=trim(p_client_idempotency_key) for update;
   if not found then raise exception 'IDEMPOTENCY_RETRY_CONFLICT'; end if;
   if v_existing.customer_id is distinct from p_customer_id or v_existing.business_id is distinct from p_business_id or coalesce(v_existing.branch_id,'')<>coalesce(p_branch_id,'') then raise exception 'IDEMPOTENCY_KEY_SCOPE_CONFLICT'; end if;
   if nullif(v_existing.metadata->>'request_hash','') is null then raise exception 'IDEMPOTENCY_LEGACY_PAYLOAD_UNVERIFIABLE'; end if;
   if v_existing.metadata->>'request_hash' is distinct from v_request_hash then raise exception 'IDEMPOTENCY_PAYLOAD_CONFLICT'; end if;
   return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'total_amount',v_existing.total_amount,'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,'pricing_hash',v_existing.pricing_hash,'pricing_snapshot',v_existing.pricing_snapshot,'idempotent',true);
 end if;
 return jsonb_build_object('id',p_order_id,'status','PENDING','subtotal',v_subtotal,'discount',v_discount,'tax',v_tax,'delivery_fee',v_delivery,'total_amount',v_total,'currency',v_currency,'pricing_version',v_pricing_version,'pricing_hash',v_hash,'pricing_snapshot',v_snapshot,'idempotent',false);
end $function$;

revoke all on function public.create_order_backend(uuid,varchar,uuid,varchar,uuid,varchar,numeric,numeric,numeric,numeric,numeric,varchar,text,text,text,jsonb,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_order_backend(uuid,varchar,uuid,varchar,uuid,varchar,numeric,numeric,numeric,numeric,numeric,varchar,text,text,text,jsonb,text,jsonb) to service_role;
