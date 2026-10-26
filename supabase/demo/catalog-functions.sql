-- DEMO-only catalogue write helpers.
-- These functions are deliberately restricted to service_role; callers must verify
-- the authenticated Supabase user first and pass that verified user ID.
-- They must never be applied to the LIVE project.

create or replace function public.demo_upsert_catalog_item_atomic(
  p_actor_user_id uuid,
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar,
  p_item_type varchar,
  p_name_ar text,
  p_name_en text default null,
  p_description text default null,
  p_sku varchar default null,
  p_tax_rate numeric default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_role text;
begin
  if p_actor_user_id is null or not exists(select 1 from auth.users u where u.id=p_actor_user_id) then
    raise exception 'DEMO_AUTH_USER_REQUIRED';
  end if;
  if p_tenant_id is distinct from 'MNTY-PLATFORM' or p_business_id is null or p_branch_id is null then
    raise exception 'DEMO_SCOPE_REQUIRED';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_name_ar,'')))<1 or pg_catalog.length(coalesce(p_name_ar,''))>180 then
    raise exception 'DEMO_INVALID_CATALOG_NAME';
  end if;
  if p_tax_rate is null or p_tax_rate<0 or p_tax_rate>100 then
    raise exception 'DEMO_INVALID_TAX_RATE';
  end if;
  if upper(coalesce(p_item_type,'PRODUCT')) not in ('PRODUCT','SERVICE') then
    raise exception 'DEMO_INVALID_ITEM_TYPE';
  end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_actor_user_id
    and m.tenant_id=p_tenant_id
    and m.business_id=p_business_id
    and m.branch_id=p_branch_id
    and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
  order by case upper(m.role) when 'OWNER' then 0 when 'BUSINESS_OWNER' then 1 when 'ADMIN' then 2 else 3 end
  limit 1;
  if v_role is null then raise exception 'DEMO_CATALOG_WRITE_FORBIDDEN'; end if;

  if not exists(
    select 1 from public.businesses b
    join public.branches br on br.business_id=b.id and br.tenant_id=b.tenant_id
    where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE'
      and coalesce(b.settings->>'environment','')='DEMO'
      and br.id=p_branch_id and br.status='ACTIVE'
  ) then raise exception 'DEMO_BUSINESS_BRANCH_NOT_FOUND'; end if;

  if p_id is null then
    insert into public.catalog_items(
      tenant_id,business_id,branch_id,item_type,name_ar,name_en,description,sku,status,tax_rate,metadata
    ) values(
      p_tenant_id,p_business_id,p_branch_id,upper(coalesce(p_item_type,'PRODUCT')),
      pg_catalog.btrim(p_name_ar),nullif(pg_catalog.btrim(coalesce(p_name_en,'')),''),
      nullif(pg_catalog.btrim(coalesce(p_description,'')),''),
      nullif(pg_catalog.btrim(coalesce(p_sku,'')),''),
      'ACTIVE',p_tax_rate,
      coalesce(p_metadata,'{}'::jsonb)||pg_catalog.jsonb_build_object('environment','DEMO','synthetic_only',true)
    ) returning id into v_id;
  else
    update public.catalog_items
      set branch_id=p_branch_id,item_type=upper(coalesce(p_item_type,item_type)),
          name_ar=pg_catalog.btrim(p_name_ar),
          name_en=nullif(pg_catalog.btrim(coalesce(p_name_en,'')),''),
          description=nullif(pg_catalog.btrim(coalesce(p_description,'')),''),
          sku=nullif(pg_catalog.btrim(coalesce(p_sku,'')),''),
          tax_rate=p_tax_rate,status='ACTIVE',
          metadata=coalesce(p_metadata,'{}'::jsonb)||pg_catalog.jsonb_build_object('environment','DEMO','synthetic_only',true),
          updated_at=now()
      where id=p_id and tenant_id=p_tenant_id and business_id=p_business_id and branch_id=p_branch_id;
    if not found then raise exception 'DEMO_CATALOG_ITEM_NOT_FOUND'; end if;
    v_id:=p_id;
  end if;

  return pg_catalog.jsonb_build_object('ok',true,'id',v_id,'environment','DEMO');
end;
$function$;

revoke all on function public.demo_upsert_catalog_item_atomic(uuid,character varying,uuid,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid) from public;
revoke all on function public.demo_upsert_catalog_item_atomic(uuid,character varying,uuid,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid) from anon,authenticated;
grant execute on function public.demo_upsert_catalog_item_atomic(uuid,character varying,uuid,character varying,character varying,text,text,text,character varying,numeric,jsonb,uuid) to service_role;

create or replace function public.demo_upsert_catalog_price_atomic(
  p_actor_user_id uuid,
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar,
  p_catalog_item_id uuid,
  p_unit_price numeric,
  p_currency varchar default 'EGP'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text;
  v_version bigint;
  v_price_id uuid;
  v_currency varchar:=upper(pg_catalog.btrim(coalesce(p_currency,'EGP')));
begin
  if p_actor_user_id is null or not exists(select 1 from auth.users u where u.id=p_actor_user_id) then
    raise exception 'DEMO_AUTH_USER_REQUIRED';
  end if;
  if p_tenant_id is distinct from 'MNTY-PLATFORM' or p_business_id is null or p_branch_id is null or p_catalog_item_id is null then
    raise exception 'DEMO_SCOPE_REQUIRED';
  end if;
  if p_unit_price is null or p_unit_price<0 or p_unit_price>100000000 then
    raise exception 'DEMO_INVALID_PRICE';
  end if;
  if v_currency<>'EGP' then raise exception 'DEMO_CURRENCY_NOT_ALLOWED'; end if;

  select upper(m.role) into v_role
  from public.user_memberships m
  where m.user_id=p_actor_user_id and m.tenant_id=p_tenant_id
    and m.business_id=p_business_id and m.branch_id=p_branch_id
    and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')
  order by case upper(m.role) when 'OWNER' then 0 when 'BUSINESS_OWNER' then 1 when 'ADMIN' then 2 else 3 end
  limit 1;
  if v_role is null then raise exception 'DEMO_PRICE_WRITE_FORBIDDEN'; end if;

  if not exists(
    select 1 from public.businesses b
    join public.branches br on br.business_id=b.id and br.tenant_id=b.tenant_id
    join public.catalog_items ci on ci.business_id=b.id and ci.tenant_id=b.tenant_id
    where b.id=p_business_id and b.tenant_id=p_tenant_id and b.status='ACTIVE'
      and coalesce(b.settings->>'environment','')='DEMO'
      and br.id=p_branch_id and br.status='ACTIVE'
      and ci.id=p_catalog_item_id and ci.branch_id=p_branch_id and ci.status='ACTIVE'
  ) then raise exception 'DEMO_CATALOG_ITEM_NOT_FOUND'; end if;

  perform 1 from public.catalog_item_prices cp
  where cp.tenant_id=p_tenant_id and cp.catalog_item_id=p_catalog_item_id
    and cp.branch_id=p_branch_id and cp.status='ACTIVE' and cp.effective_to is null
  for update;

  update public.catalog_item_prices cp
    set effective_to=now(),status='INACTIVE'
  where cp.tenant_id=p_tenant_id and cp.catalog_item_id=p_catalog_item_id
    and cp.branch_id=p_branch_id and cp.status='ACTIVE' and cp.effective_to is null;

  select coalesce(max(cp.version),0)+1 into v_version
  from public.catalog_item_prices cp
  where cp.tenant_id=p_tenant_id and cp.catalog_item_id=p_catalog_item_id
    and cp.branch_id=p_branch_id;

  insert into public.catalog_item_prices(
    tenant_id,catalog_item_id,branch_id,currency,unit_price,version,status,effective_from
  ) values(
    p_tenant_id,p_catalog_item_id,p_branch_id,v_currency,p_unit_price,v_version,'ACTIVE',now()
  ) returning id into v_price_id;

  return pg_catalog.jsonb_build_object('ok',true,'id',v_price_id,'version',v_version,'unit_price',p_unit_price,'currency',v_currency,'environment','DEMO');
end;
$function$;

revoke all on function public.demo_upsert_catalog_price_atomic(uuid,character varying,uuid,character varying,uuid,numeric,character varying) from public;
revoke all on function public.demo_upsert_catalog_price_atomic(uuid,character varying,uuid,character varying,uuid,numeric,character varying) from anon,authenticated;
grant execute on function public.demo_upsert_catalog_price_atomic(uuid,character varying,uuid,character varying,uuid,numeric,character varying) to service_role;
