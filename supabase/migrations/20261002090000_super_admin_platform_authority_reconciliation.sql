-- RC220: reconcile SUPER_ADMIN source authority with the live catalog/branch path.
insert into public.user_memberships
  (id,user_id,tenant_id,organization_id,business_id,branch_id,role,permissions,status)
select
  'MNTY-SUPER-ADMIN-' || lower(t.id) || '-' || replace(pa.user_id::text,'-',''),
  pa.user_id,t.id,null,null,null,'SUPER_ADMIN',
  jsonb_build_object('scope','PLATFORM','full_control',true),'ACTIVE'
from private.platform_admins pa
cross join public.tenants t
where t.status='ACTIVE'
  and not exists (
    select 1 from public.user_memberships um
    where um.user_id=pa.user_id and um.tenant_id=t.id and upper(um.role)='SUPER_ADMIN' and um.status='ACTIVE'
  );

create or replace function public.upsert_catalog_item_backend(
  p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_legacy_ref varchar,p_item_type varchar,p_name_ar text,p_name_en text,p_description text,p_sku varchar,p_tax_rate numeric,p_metadata jsonb,p_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE' and (upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER') or (upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id) then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if p_tax_rate<0 or p_tax_rate>100 or nullif(trim(p_name_ar),'') is null then raise exception 'INVALID_CATALOG_ITEM'; end if;
 if p_id is null then insert into catalog_items(tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,description,sku,tax_rate,metadata) values(p_tenant_id,p_business_id,p_branch_id,nullif(trim(p_legacy_ref),''),upper(coalesce(p_item_type,'PRODUCT')),trim(p_name_ar),p_name_en,p_description,p_sku,p_tax_rate,coalesce(p_metadata,'{}')) returning id into v_id;
 else update catalog_items set branch_id=p_branch_id,legacy_ref=nullif(trim(p_legacy_ref),''),item_type=upper(coalesce(p_item_type,item_type)),name_ar=trim(p_name_ar),name_en=p_name_en,description=p_description,sku=p_sku,tax_rate=p_tax_rate,metadata=coalesce(p_metadata,metadata),updated_at=now() where id=p_id and tenant_id=p_tenant_id and business_id=p_business_id returning id into v_id; if v_id is null then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if; end if;
 return jsonb_build_object('id',v_id);
end $function$;

create or replace function public.upsert_catalog_price_backend(
 p_tenant_id varchar,p_business_id uuid,p_catalog_item_id uuid,p_branch_id varchar,p_currency varchar,p_unit_price numeric,p_effective_from timestamptz default now(),p_effective_to timestamptz default null
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_id uuid; v_version bigint;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from user_memberships m where m.user_id=auth.uid() and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE' and (upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER') or (upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true))) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 if not exists(select 1 from catalog_items ci where ci.id=p_catalog_item_id and ci.tenant_id=p_tenant_id and ci.business_id=p_business_id) then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if;
 if p_unit_price<0 then raise exception 'INVALID_PRICE'; end if;
 select coalesce(max(version),0)+1 into v_version from catalog_item_prices where catalog_item_id=p_catalog_item_id and coalesce(branch_id,'')=coalesce(p_branch_id,'');
 insert into catalog_item_prices(tenant_id,catalog_item_id,branch_id,currency,unit_price,version,effective_from,effective_to) values(p_tenant_id,p_catalog_item_id,p_branch_id,upper(trim(coalesce(p_currency,'EGP'))),p_unit_price,v_version,coalesce(p_effective_from,now()),p_effective_to) returning id into v_id;
 return jsonb_build_object('id',v_id,'version',v_version);
end $function$;

create or replace function public.upsert_catalog_settings_backend(
 p_tenant_id varchar,p_business_id uuid,p_currency varchar default 'EGP',p_delivery_fee numeric default 0,p_tax_inclusive boolean default false,p_allow_discounts boolean default false
) returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_uid uuid:=auth.uid(); v_role text; v_row public.catalog_business_settings%rowtype;
begin
 if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then raise exception 'UNAUTHENTICATED'; end if;
 if p_currency is null or upper(trim(p_currency)) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY'; end if;
 if p_delivery_fee<0 then raise exception 'INVALID_DELIVERY_FEE'; end if;
 select upper(m.role::text) into v_role from public.user_memberships m where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE' and (m.business_id=p_business_id or m.business_id is null) order by case upper(m.role::text) when 'SUPER_ADMIN' then 0 when 'OWNER' then 1 when 'ADMIN' then 2 when 'BUSINESS_OWNER' then 3 when 'MANAGER' then 4 else 99 end limit 1;
 if v_role is null or v_role not in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SUPER_ADMIN') then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 if v_role='SUPER_ADMIN' and not exists(select 1 from user_memberships m where m.user_id=v_uid and m.tenant_id=p_tenant_id and m.status='ACTIVE' and upper(m.role)='SUPER_ADMIN' and coalesce(m.permissions->>'scope','')='PLATFORM' and coalesce((m.permissions->>'full_control')::boolean,false)=true) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;
 insert into public.catalog_business_settings(business_id,tenant_id,currency,delivery_fee,tax_inclusive,allow_discounts,updated_at) values(p_business_id,p_tenant_id,upper(trim(p_currency)),p_delivery_fee,p_tax_inclusive,p_allow_discounts,now()) on conflict(business_id) do update set tenant_id=excluded.tenant_id,currency=excluded.currency,delivery_fee=excluded.delivery_fee,tax_inclusive=excluded.tax_inclusive,allow_discounts=excluded.allow_discounts,updated_at=now() returning * into v_row;
 return to_jsonb(v_row);
end $function$;