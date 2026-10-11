-- RC459: keep restaurant menu mutations and the canonical order catalog in one transaction.
-- This migration is a candidate change only; do not apply to production without the release gate.
create or replace function public.restaurant_menu_catalog_mutate_backend(
  p_actor_user_id uuid,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := upper(coalesce(p_action, ''));
  v_id text := nullif(trim(p_payload ->> 'id'), '');
  v_tenant_id varchar := nullif(trim(p_payload ->> 'tenant_id'), '');
  v_business_id uuid := nullif(trim(p_payload ->> 'business_id'), '')::uuid;
  v_branch_id varchar := nullif(trim(p_payload ->> 'branch_id'), '');
  v_name text := trim(coalesce(p_payload ->> 'name_ar', ''));
  v_description text := coalesce(p_payload ->> 'description_ar', '');
  v_category text := trim(coalesce(p_payload ->> 'category', ''));
  v_price numeric := nullif(p_payload ->> 'base_price_egp', '')::numeric;
  v_available boolean := coalesce((p_payload ->> 'is_available')::boolean, true);
  v_popular boolean := coalesce((p_payload ->> 'is_popular')::boolean, false);
  v_legacy_ref text;
  v_menu public.restaurant_menu_items%rowtype;
  v_catalog public.catalog_items%rowtype;
  v_active_price public.catalog_item_prices%rowtype;
  v_menu_exists boolean := false;
  v_catalog_exists boolean := false;
  v_menu_changed boolean := false;
  v_catalog_changed boolean := false;
  v_price_changed boolean := false;
  v_price_id uuid;
  v_price_version bigint;
begin
  if p_actor_user_id is null then raise exception 'ACTOR_REQUIRED'; end if;
  if v_action not in ('CREATE','UPDATE') then raise exception 'INVALID_MENU_ACTION'; end if;
  if v_id is null or length(v_id) > 100 then raise exception 'INVALID_MENU_ITEM_ID'; end if;
  if v_tenant_id is null or v_business_id is null or v_branch_id is null then raise exception 'MENU_SCOPE_REQUIRED'; end if;
  if v_name = '' or length(v_name) > 200 or length(v_description) > 2000 or v_category = '' or length(v_category) > 120 then
    raise exception 'INVALID_MENU_FIELDS';
  end if;
  if v_price is null or v_price < 0 or v_price::text in ('NaN','Infinity','-Infinity') or v_price > 1000000000 then
    raise exception 'INVALID_MENU_PRICE';
  end if;

  if not exists (
    select 1 from public.user_memberships m
    where m.user_id = p_actor_user_id
      and m.tenant_id = v_tenant_id
      and m.business_id = v_business_id
      and m.branch_id = v_branch_id
      and m.status = 'ACTIVE'
      and upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
  ) then raise exception 'RESTAURANT_MENU_FORBIDDEN'; end if;

  if not exists (
    select 1 from public.businesses b
    where b.id = v_business_id and b.tenant_id = v_tenant_id and upper(coalesce(b.status,'')) = 'ACTIVE'
  ) then raise exception 'RESTAURANT_BUSINESS_UNAVAILABLE'; end if;
  if not exists (
    select 1 from public.branches br
    where br.id = v_branch_id and br.business_id = v_business_id and br.tenant_id = v_tenant_id and upper(coalesce(br.status,'')) = 'ACTIVE'
  ) then raise exception 'RESTAURANT_BRANCH_UNAVAILABLE'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_business_id::text || ':' || v_id, 0)
  );

  select * into v_menu
  from public.restaurant_menu_items m
  where m.id = v_id
  for update;
  v_menu_exists := found;

  if v_menu_exists then
    if v_menu.owner_user_id is distinct from p_actor_user_id
       or v_menu.tenant_id is distinct from v_tenant_id
       or v_menu.business_id is distinct from v_business_id
       or v_menu.branch_id is distinct from v_branch_id then
      raise exception 'RESTAURANT_MENU_ITEM_FORBIDDEN';
    end if;
    if v_menu.name_ar is distinct from v_name
       or v_menu.description_ar is distinct from v_description
       or v_menu.category is distinct from v_category
       or v_menu.base_price_egp is distinct from v_price
       or v_menu.is_available is distinct from v_available
       or v_menu.is_popular is distinct from v_popular then
      v_menu_changed := true;
      update public.restaurant_menu_items
      set name_ar=v_name, description_ar=v_description, category=v_category,
          base_price_egp=v_price, is_available=v_available, is_popular=v_popular,
          updated_at=pg_catalog.now()
      where id=v_id
      returning * into v_menu;
    end if;
  else
    if v_action = 'UPDATE' then raise exception 'RESTAURANT_MENU_ITEM_NOT_FOUND'; end if;
    insert into public.restaurant_menu_items(
      id,owner_user_id,name_ar,description_ar,base_price_egp,category,is_available,is_popular,
      tenant_id,business_id,branch_id,created_at,updated_at
    ) values (
      v_id,p_actor_user_id,v_name,v_description,v_price,v_category,v_available,v_popular,
      v_tenant_id,v_business_id,v_branch_id,pg_catalog.now(),pg_catalog.now()
    ) returning * into v_menu;
    v_menu_changed := true;
  end if;

  v_legacy_ref := 'RESTAURANT_MENU:' || v_id;
  select * into v_catalog
  from public.catalog_items ci
  where ci.business_id=v_business_id and ci.legacy_ref=v_legacy_ref
  for update;
  v_catalog_exists := found;

  if v_catalog_exists then
    if v_catalog.tenant_id is distinct from v_tenant_id
       or v_catalog.branch_id is distinct from v_branch_id then
      raise exception 'RESTAURANT_CATALOG_SCOPE_CONFLICT';
    end if;
    if v_catalog.item_type is distinct from 'PRODUCT'
       or v_catalog.name_ar is distinct from v_name
       or v_catalog.description is distinct from nullif(v_description,'')
       or v_catalog.status is distinct from case when v_available then 'ACTIVE' else 'INACTIVE' end
       or v_catalog.tax_rate is distinct from 0::numeric
       or coalesce(v_catalog.metadata ->> 'restaurant_menu_item_id','') is distinct from v_id then
      update public.catalog_items
      set item_type='PRODUCT',name_ar=v_name,description=nullif(v_description,''),
          status=case when v_available then 'ACTIVE' else 'INACTIVE' end,
          tax_rate=0,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'source','restaurant_menu_items','restaurant_menu_item_id',v_id
          ),
          updated_at=pg_catalog.now()
      where id=v_catalog.id
      returning * into v_catalog;
      v_catalog_changed := true;
    end if;
  else
    insert into public.catalog_items(
      tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,description,status,tax_rate,metadata
    ) values (
      v_tenant_id,v_business_id,v_branch_id,v_legacy_ref,'PRODUCT',v_name,nullif(v_description,''),
      case when v_available then 'ACTIVE' else 'INACTIVE' end,0,
      jsonb_build_object('source','restaurant_menu_items','restaurant_menu_item_id',v_id)
    ) returning * into v_catalog;
    v_catalog_changed := true;
  end if;

  select * into v_active_price
  from public.catalog_item_prices p
  where p.tenant_id=v_tenant_id
    and p.catalog_item_id=v_catalog.id
    and p.branch_id=v_branch_id
    and upper(p.currency)='EGP'
    and p.status='ACTIVE'
    and p.effective_from <= pg_catalog.now()
    and (p.effective_to is null or p.effective_to > pg_catalog.now())
  order by p.version desc
  limit 1
  for update;

  if found and v_active_price.unit_price = v_price then
    v_price_id := v_active_price.id;
    v_price_version := v_active_price.version;
  else
    update public.catalog_item_prices p
    set status='INACTIVE',effective_to=pg_catalog.now()
    where p.tenant_id=v_tenant_id
      and p.catalog_item_id=v_catalog.id
      and p.branch_id=v_branch_id
      and upper(p.currency)='EGP'
      and p.status='ACTIVE';
    select coalesce(max(p.version),0)+1 into v_price_version
    from public.catalog_item_prices p
    where p.catalog_item_id=v_catalog.id and p.branch_id=v_branch_id and upper(p.currency)='EGP';
    insert into public.catalog_item_prices(
      tenant_id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from,effective_to
    ) values (
      v_tenant_id,v_catalog.id,v_branch_id,'EGP',v_price,v_price_version,'ACTIVE',pg_catalog.now(),null
    ) returning id into v_price_id;
    v_price_changed := true;
  end if;

  if v_menu_changed or v_catalog_changed or v_price_changed then
    insert into public.audit_logs(
      id,tenant_id,business_id,branch_id,actor_user_id,action,entity_type,entity_id,
      old_values,new_values,result,created_at
    ) values (
      'AUD-REST-' || replace(pg_catalog.gen_random_uuid()::text,'-',''),
      v_tenant_id,v_business_id,v_branch_id,p_actor_user_id,
      'RESTAURANT_MENU_CATALOG_' || v_action,'RESTAURANT_MENU_ITEM',v_id,
      case when v_menu_exists then pg_catalog.to_jsonb(v_menu) else '{}'::jsonb end,
      pg_catalog.to_jsonb(v_menu) || jsonb_build_object(
        'catalog_item_id',v_catalog.id,'price_id',v_price_id,'price_version',v_price_version
      ),
      'SUCCESS',pg_catalog.now()
    );
  end if;

  return jsonb_build_object(
    'ok',true,'item_id',v_id,'catalog_item_id',v_catalog.id,
    'price_id',v_price_id,'price_version',v_price_version,
    'changed',(v_menu_changed or v_catalog_changed or v_price_changed)
  );
end;
$function$;

revoke all on function public.restaurant_menu_catalog_mutate_backend(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.restaurant_menu_catalog_mutate_backend(uuid,text,jsonb) to service_role;
