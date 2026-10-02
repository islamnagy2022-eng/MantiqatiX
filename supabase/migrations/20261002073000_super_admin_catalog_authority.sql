-- RC217: extend catalog backend authorization to the authoritative platform admin.
-- SUPER_ADMIN is not a replacement for RLS; it is an explicit server-side authority.
-- Existing tenant/business checks remain in force.

create or replace function public.upsert_catalog_item_backend(
  p_tenant_id varchar,
  p_business_id uuid,
  p_branch_id varchar,
  p_legacy_ref varchar,
  p_item_type varchar,
  p_name_ar text,
  p_name_en text,
  p_description text,
  p_sku varchar,
  p_tax_rate numeric,
  p_metadata jsonb,
  p_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists(
    select 1 from user_memberships m
    where m.user_id=auth.uid()
      and m.tenant_id=p_tenant_id
      and coalesce(m.status,'ACTIVE')='ACTIVE'
      and (
        upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER')
        or (
          upper(m.role)='SUPER_ADMIN'
          and coalesce((m.permissions->>'scope'),'')='PLATFORM'
          and coalesce((m.permissions->>'full_control')::boolean,false)=true
        )
      )
  ) then raise exception 'CATALOG_WRITE_FORBIDDEN'; end if;

  if not exists(select 1 from businesses b where b.id=p_business_id and b.tenant_id=p_tenant_id)
    then raise exception 'BUSINESS_TENANT_MISMATCH'; end if;

  if p_tax_rate < 0 or p_tax_rate > 100 or nullif(trim(p_name_ar),'') is null
    then raise exception 'INVALID_CATALOG_ITEM'; end if;

  if p_id is null then
    insert into catalog_items(
      tenant_id,business_id,branch_id,legacy_ref,item_type,name_ar,name_en,
      description,sku,tax_rate,metadata
    ) values (
      p_tenant_id,p_business_id,p_branch_id,nullif(trim(p_legacy_ref),''),
      upper(coalesce(p_item_type,'PRODUCT')),trim(p_name_ar),p_name_en,
      p_description,p_sku,p_tax_rate,coalesce(p_metadata,'{}')
    ) returning id into v_id;
  else
    update catalog_items
       set branch_id=p_branch_id,
           legacy_ref=nullif(trim(p_legacy_ref),''),
           item_type=upper(coalesce(p_item_type,item_type)),
           name_ar=trim(p_name_ar),
           name_en=p_name_en,
           description=p_description,
           sku=p_sku,
           tax_rate=p_tax_rate,
           metadata=coalesce(p_metadata,metadata),
           updated_at=now()
     where id=p_id and tenant_id=p_tenant_id and business_id=p_business_id
     returning id into v_id;

    if v_id is null then raise exception 'CATALOG_ITEM_NOT_FOUND'; end if;
  end if;

  return jsonb_build_object('id',v_id);
end
$function$;
