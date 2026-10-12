create extension if not exists pgcrypto;

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null references public.tenants(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id varchar null references public.branches(id) on delete set null,
  legacy_ref varchar(160),
  item_type varchar(32) not null default 'PRODUCT',
  name_ar text not null,
  name_en text,
  description text,
  sku varchar(120),
  status varchar(24) not null default 'ACTIVE',
  tax_rate numeric(7,4) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_status_chk check (status in ('ACTIVE','INACTIVE','ARCHIVED')),
  constraint catalog_items_tax_chk check (tax_rate >= 0 and tax_rate <= 100)
);
create index if not exists idx_catalog_items_business_status on public.catalog_items(tenant_id,business_id,status);
create index if not exists idx_catalog_items_branch on public.catalog_items(tenant_id,business_id,branch_id,status);
create unique index if not exists ux_catalog_items_business_legacy_ref on public.catalog_items(business_id, legacy_ref) where legacy_ref is not null;

create table if not exists public.catalog_item_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null references public.tenants(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  name_ar text not null,
  name_en text,
  price_delta numeric(14,2) not null default 0,
  status varchar(24) not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_item_options_status_chk check (status in ('ACTIVE','INACTIVE','ARCHIVED')),
  constraint catalog_item_options_price_chk check (price_delta >= 0)
);
create index if not exists idx_catalog_item_options_item on public.catalog_item_options(catalog_item_id,status);

create table if not exists public.catalog_item_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id varchar not null references public.tenants(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  branch_id varchar null references public.branches(id) on delete cascade,
  currency varchar(8) not null default 'EGP',
  unit_price numeric(14,2) not null,
  version bigint not null default 1,
  status varchar(24) not null default 'ACTIVE',
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_at timestamptz not null default now(),
  constraint catalog_item_prices_amount_chk check (unit_price >= 0),
  constraint catalog_item_prices_status_chk check (status in ('ACTIVE','INACTIVE','ARCHIVED')),
  constraint catalog_item_prices_currency_chk check (currency = upper(currency)),
  constraint catalog_item_prices_effective_chk check (effective_to is null or effective_to > effective_from)
);
create index if not exists idx_catalog_item_prices_lookup on public.catalog_item_prices(catalog_item_id,branch_id,status,effective_from desc);

create table if not exists public.catalog_business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  tenant_id varchar not null references public.tenants(id) on delete cascade,
  currency varchar(8) not null default 'EGP',
  delivery_fee numeric(14,2) not null default 0,
  tax_inclusive boolean not null default false,
  allow_discounts boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint catalog_business_settings_delivery_chk check (delivery_fee >= 0),
  constraint catalog_business_settings_currency_chk check (currency = upper(currency))
);

alter table public.orders add column if not exists pricing_version bigint;
alter table public.orders add column if not exists pricing_snapshot jsonb;
alter table public.orders add column if not exists pricing_hash varchar(64);
alter table public.orders add column if not exists pricing_authority varchar(64);

alter table public.catalog_items enable row level security;
alter table public.catalog_items force row level security;
alter table public.catalog_item_options enable row level security;
alter table public.catalog_item_options force row level security;
alter table public.catalog_item_prices enable row level security;
alter table public.catalog_item_prices force row level security;
alter table public.catalog_business_settings enable row level security;
alter table public.catalog_business_settings force row level security;

create policy catalog_items_member_read on public.catalog_items for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true' and exists (
  select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=catalog_items.tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE'
));
create policy catalog_item_options_member_read on public.catalog_item_options for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true' and exists (
  select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=catalog_item_options.tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE'
));
create policy catalog_item_prices_member_read on public.catalog_item_prices for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true' and exists (
  select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=catalog_item_prices.tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE'
));
create policy catalog_business_settings_member_read on public.catalog_business_settings for select to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true' and exists (
  select 1 from public.user_memberships m where m.user_id=auth.uid() and m.tenant_id=catalog_business_settings.tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE'
));

create or replace function public.create_order_backend(
 p_order_id uuid,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_customer_id uuid,
 p_client_idempotency_key varchar,p_subtotal numeric,p_discount numeric,p_tax numeric,p_delivery_fee numeric,p_total_amount numeric,
 p_currency varchar,p_customer_name text,p_customer_phone text,p_delivery_address text,p_items_json jsonb,p_notes text default null,p_metadata jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_existing orders; v_settings catalog_business_settings; v_currency varchar; v_subtotal numeric:=0; v_tax numeric:=0; v_total numeric:=0; v_delivery numeric:=0; v_discount numeric:=0; v_snapshot jsonb:='[]'; v_item jsonb; v_ci catalog_items; v_price catalog_item_prices; v_opt_total numeric; v_opt_count int; v_requested_opts int; v_qty numeric; v_line numeric; v_line_tax numeric; v_token text; v_hash text; v_pricing_version bigint:=0;
begin
 if p_customer_id is null or auth.uid() is null or auth.uid()<>p_customer_id then raise exception 'CUSTOMER_REQUIRED'; end if;
 if p_tenant_id is null or p_tenant_id='' or p_business_id is null or p_client_idempotency_key is null or length(trim(p_client_idempotency_key))<8 then raise exception 'INVALID_ORDER_REQUEST'; end if;
 if p_items_json is null or jsonb_typeof(p_items_json)<>'array' or jsonb_array_length(p_items_json)=0 then raise exception 'INVALID_ITEMS'; end if;
 if not exists(select 1 from user_memberships m where m.user_id=p_customer_id and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE') then raise exception 'MEMBERSHIP_REQUIRED'; end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and coalesce(b.status,'ACTIVE')='ACTIVE') then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if p_branch_id is not null and not exists(select 1 from branches br where br.id=p_branch_id and br.business_id=p_business_id and br.tenant_id=p_tenant_id and coalesce(br.status,'ACTIVE')='ACTIVE') then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
 select * into v_existing from orders where tenant_id=p_tenant_id and client_idempotency_key=trim(p_client_idempotency_key) for update;
 if found then return jsonb_build_object('id',v_existing.id,'status',v_existing.status,'total_amount',v_existing.total_amount,'currency',v_existing.currency,'pricing_version',v_existing.pricing_version,'pricing_hash',v_existing.pricing_hash,'pricing_snapshot',v_existing.pricing_snapshot,'idempotent',true); end if;
 select * into v_settings from catalog_business_settings where business_id=p_business_id;
 if not found then
   insert into catalog_business_settings(business_id,tenant_id) values(p_business_id,p_tenant_id) on conflict (business_id) do nothing;
   select * into v_settings from catalog_business_settings where business_id=p_business_id;
 end if;
 v_currency:=upper(coalesce(v_settings.currency,p_currency,'EGP'));
 v_delivery:=v_settings.delivery_fee;
 v_discount:=0;
 for v_item in select value from jsonb_array_elements(p_items_json) loop
   v_token:=coalesce(nullif(v_item->>'catalogItemId',''),nullif(v_item->>'productId',''));
   if v_token is null then raise exception 'CATALOG_ITEM_REQUIRED'; end if;
   select * into v_ci from catalog_items ci where ci.tenant_id=p_tenant_id and ci.business_id=p_business_id and ci.status='ACTIVE' and (ci.id::text=v_token or ci.legacy_ref=v_token) and (ci.branch_id is null or ci.branch_id=p_branch_id) order by (ci.branch_id is not null) desc limit 1;
   if not found then raise exception 'CATALOG_ITEM_NOT_FOUND:%',v_token; end if;
   v_qty:=coalesce(nullif(v_item->>'quantity','')::numeric,0);
   if v_qty<=0 or v_qty>10000 then raise exception 'INVALID_QUANTITY'; end if;
   select * into v_price from catalog_item_prices cp where cp.catalog_item_id=v_ci.id and cp.tenant_id=p_tenant_id and cp.status='ACTIVE' and cp.effective_from<=now() and (cp.effective_to is null or cp.effective_to>now()) and (cp.branch_id is null or cp.branch_id=p_branch_id) order by (cp.branch_id is not null) desc, cp.effective_from desc, cp.version desc limit 1;
   if not found then raise exception 'CATALOG_PRICE_NOT_FOUND:%',v_ci.id; end if;
   select coalesce(sum(o.price_delta),0), count(o.id) into v_opt_total,v_opt_count from catalog_item_options o where o.catalog_item_id=v_ci.id and o.status='ACTIVE' and o.id::text in (select jsonb_array_elements_text(coalesce(v_item->'selectedOptionIds','[]'::jsonb)));
   v_requested_opts:=jsonb_array_length(coalesce(v_item->'selectedOptionIds','[]'::jsonb));
   if v_opt_count<>v_requested_opts then raise exception 'INVALID_ITEM_OPTIONS'; end if;
   v_line:=round((v_price.unit_price+v_opt_total)*v_qty,2);
   v_line_tax:=case when v_settings.tax_inclusive then 0 else round(v_line*v_ci.tax_rate/100,2) end;
   v_subtotal:=v_subtotal+v_line;
   v_tax:=v_tax+v_line_tax;
   v_pricing_version:=greatest(v_pricing_version,v_price.version);
   v_snapshot:=v_snapshot || jsonb_build_array(jsonb_build_object('catalog_item_id',v_ci.id,'legacy_ref',v_ci.legacy_ref,'name_ar',v_ci.name_ar,'quantity',v_qty,'unit_price',v_price.unit_price,'option_total',v_opt_total,'tax_rate',v_ci.tax_rate,'line_subtotal',v_line,'line_tax',v_line_tax,'price_version',v_price.version,'price_effective_from',v_price.effective_from,'branch_id',v_price.branch_id));
 end loop;
 v_total:=round(v_subtotal-v_discount+v_tax+v_delivery,2);
 v_hash:=encode(digest(v_snapshot::text || '|' || v_currency || '|' || v_total::text || '|' || v_delivery::text || '|' || v_tax::text || '|' || v_discount::text,'sha256'),'hex');
 insert into orders(id,tenant_id,business_id,branch_id,customer_id,status,subtotal,discount,tax,delivery_fee,total_amount,currency,customer_name,customer_phone,delivery_address,items_json,notes,metadata,client_idempotency_key,pricing_version,pricing_snapshot,pricing_hash,pricing_authority)
 values(p_order_id,p_tenant_id,p_business_id,p_branch_id,p_customer_id,'PENDING',v_subtotal,v_discount,v_tax,v_delivery,v_total,v_currency,p_customer_name,p_customer_phone,p_delivery_address,v_snapshot,p_notes,coalesce(p_metadata,'{}') || jsonb_build_object('pricing_server_authoritative',true),trim(p_client_idempotency_key),v_pricing_version,v_snapshot,v_hash,'catalog_v1');
 return jsonb_build_object('id',p_order_id,'status','PENDING','subtotal',v_subtotal,'discount',v_discount,'tax',v_tax,'delivery_fee',v_delivery,'total_amount',v_total,'currency',v_currency,'pricing_version',v_pricing_version,'pricing_hash',v_hash,'pricing_snapshot',v_snapshot,'idempotent',false);
end $$;
revoke all on function public.create_order_backend(uuid,varchar,uuid,varchar,uuid,varchar,numeric,numeric,numeric,numeric,numeric,varchar,text,text,text,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_order_backend(uuid,varchar,uuid,varchar,uuid,varchar,numeric,numeric,numeric,numeric,numeric,varchar,text,text,text,jsonb,text,jsonb) to service_role;

do $$ declare t text; begin for t in select unnest(array['catalog_items','catalog_item_options','catalog_item_prices','catalog_business_settings']) loop execute format('create policy %I on public.%I as restrictive for all to authenticated using (coalesce((auth.jwt()->>''is_anonymous''),''false'')<>''true'') with check (coalesce((auth.jwt()->>''is_anonymous''),''false'')<>''true'')','authenticated_sessions_only',t); end loop; end $$;
