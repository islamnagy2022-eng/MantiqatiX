-- RC498 — restore the verified RC105 order identity/idempotency contract and harden its SECURITY DEFINER path.
-- Authenticated callers are safe because auth.uid() must match p_customer_id.
-- The verified Edge Function may also continue using service_role after auth.getUser(token).

BEGIN;

create or replace function public.create_order_backend(
 p_order_id uuid,p_tenant_id varchar,p_business_id uuid,p_branch_id varchar,p_customer_id uuid,
 p_client_idempotency_key varchar,p_subtotal numeric,p_discount numeric,p_tax numeric,p_delivery_fee numeric,
 p_total_amount numeric,p_currency varchar,p_customer_name text,p_customer_phone text,p_delivery_address text,
 p_items_json jsonb,p_notes text default null,p_metadata jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=pg_catalog, public, extensions, pg_temp as $$
declare
 v_existing orders; v_settings catalog_business_settings; v_currency varchar;
 v_subtotal numeric:=0; v_tax numeric:=0; v_total numeric:=0; v_delivery numeric:=0; v_discount numeric:=0;
 v_snapshot jsonb:='[]'; v_item jsonb; v_ci catalog_items; v_price catalog_item_prices;
 v_opt_total numeric; v_opt_count int; v_requested_opts int; v_qty numeric; v_line numeric; v_line_tax numeric;
 v_token text; v_hash text; v_pricing_version bigint:=0; v_customer_member boolean:=false;
begin
 if p_customer_id is null then raise exception 'CUSTOMER_REQUIRED'; end if;
 -- Edge Functions verify the bearer token with auth.getUser(token), then invoke this
 -- backend-only RPC using the service-role client. Direct non-service-role calls
 -- must still bind the requested customer to auth.uid().
 if coalesce(auth.role(),'') <> 'service_role'
   and (auth.uid() is null or auth.uid() is distinct from p_customer_id) then
   raise exception 'CUSTOMER_REQUIRED';
 end if;
 if p_tenant_id is null or p_tenant_id='' or p_business_id is null or p_client_idempotency_key is null or length(trim(p_client_idempotency_key))<8 then raise exception 'INVALID_ORDER_REQUEST'; end if;
 if p_items_json is null or jsonb_typeof(p_items_json)<>'array' or jsonb_array_length(p_items_json)=0 then raise exception 'INVALID_ITEMS'; end if;
 select exists(select 1 from user_memberships m where m.user_id=p_customer_id and m.tenant_id=p_tenant_id and coalesce(m.status,'ACTIVE')='ACTIVE') into v_customer_member;
 if not v_customer_member and not exists(select 1 from user_memberships m where m.user_id=p_customer_id and coalesce(m.status,'ACTIVE')='ACTIVE' and upper(m.role)='CUSTOMER') then raise exception 'CUSTOMER_MEMBERSHIP_REQUIRED'; end if;
 if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id and coalesce(b.status,'ACTIVE')='ACTIVE') then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;
 if not exists(select 1 from marketing_provider_profiles pp where pp.business_id=p_business_id and pp.status='ACTIVE') then raise exception 'PROVIDER_NOT_AVAILABLE'; end if;
 if p_branch_id is not null and not exists(select 1 from branches br where br.id=p_branch_id and br.business_id=p_business_id and br.tenant_id=p_tenant_id and coalesce(br.status,'ACTIVE')='ACTIVE') then raise exception 'BRANCH_BUSINESS_MISMATCH'; end if;
 -- An idempotency key is scoped to one customer, business, and branch.
 -- Never return an existing order snapshot to a different principal or scope.
 if exists (
   select 1 from orders o
   where o.tenant_id=p_tenant_id
     and o.client_idempotency_key=trim(p_client_idempotency_key)
     and (
       o.customer_id is distinct from p_customer_id
       or o.business_id is distinct from p_business_id
       or o.branch_id is distinct from p_branch_id
     )
 ) then
   raise exception 'IDEMPOTENCY_KEY_CONFLICT';
 end if;

 select * into v_existing from orders
 where tenant_id=p_tenant_id
   and client_idempotency_key=trim(p_client_idempotency_key)
   and customer_id=p_customer_id
   and business_id=p_business_id
   and branch_id is not distinct from p_branch_id
 for update;
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

DO $postflight$
DECLARE
  v_oid oid := to_regprocedure(
    'public.create_order_backend(uuid, character varying, uuid, character varying, uuid, character varying, numeric, numeric, numeric, numeric, numeric, character varying, text, text, text, jsonb, text, jsonb)'
  );
  v_def text;
  v_config text[];
BEGIN
  IF v_oid IS NULL THEN RAISE EXCEPTION 'RC498_CREATE_ORDER_BACKEND_MISSING'; END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = v_oid) THEN
    RAISE EXCEPTION 'RC498_CREATE_ORDER_BACKEND_MUST_REMAIN_SECURITY_DEFINER';
  END IF;
  v_def := pg_get_functiondef(v_oid);
  IF position('auth.uid()' IN v_def) = 0
     OR position('auth.role()' IN v_def) = 0
     OR position('IDEMPOTENCY_KEY_CONFLICT' IN v_def) = 0
     OR position('catalog_item_prices' IN v_def) = 0
     OR position('CUSTOMER_REQUIRED' IN v_def) = 0 THEN
    RAISE EXCEPTION 'RC498_ORDER_IDENTITY_IDEMPOTENCY_OR_PRICING_GUARD_MISSING';
  END IF;
  SELECT proconfig INTO v_config FROM pg_proc WHERE oid = v_oid;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(v_config, ARRAY[]::text[])) setting
     WHERE setting = 'search_path=pg_catalog, public, extensions, pg_temp'
  ) THEN
    RAISE EXCEPTION 'RC498_ORDER_RPC_SEARCH_PATH_NOT_HARDENED: %', v_config;
  END IF;
END
$postflight$;

-- Do not expose the privileged RPC to anonymous or PUBLIC callers. Authenticated
-- callers are bound to auth.uid() by the restored RC105 body. Preserve the existing
-- explicit service_role grant for the verified server-side Edge Function path.
REVOKE ALL ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) TO service_role;

COMMENT ON FUNCTION public.create_order_backend(
  uuid, character varying, uuid, character varying, uuid, character varying,
  numeric, numeric, numeric, numeric, numeric, character varying,
  text, text, text, jsonb, text, jsonb
) IS 'RC498: restore RC105 customer identity and idempotency scope; authenticated callers must match auth.uid(), service-role calls require verified Edge identity; server pricing remains authoritative.';

COMMIT;
