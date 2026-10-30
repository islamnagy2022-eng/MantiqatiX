-- Forward-only repair: the later consolidated RC113-RC116 dependency migration
-- reintroduced the pre-RC117 admin business function and dropped RC117's
-- synchronization of the official provider profile name/description.
-- Restore the reviewed RC117 implementation without rewriting history.

create or replace function public.mnty_platform_admin_manage_business(
  p_business_id uuid,
  p_name text,
  p_settings jsonb default null,
  p_action text default 'UPDATE'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_business public.businesses%rowtype;
  v_old jsonb;
  v_action text := upper(coalesce(p_action,'UPDATE'));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then raise exception 'PLATFORM_ADMIN_REQUIRED'; end if;
  if v_action not in ('UPDATE','DEACTIVATE','RESTORE') then raise exception 'INVALID_BUSINESS_ACTION'; end if;
  select * into v_business from public.businesses where id=p_business_id for update;
  if not found then raise exception 'BUSINESS_NOT_FOUND'; end if;

  v_old:=jsonb_build_object('name',v_business.name,'status',v_business.status,'settings',v_business.settings);
  if v_action='UPDATE' then
    if nullif(trim(p_name),'') is null then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
    update public.businesses
      set name=trim(p_name),
          settings=case when p_settings is null then v_business.settings else coalesce(v_business.settings,'{}'::jsonb) || p_settings end,
          updated_at=now()
      where id=p_business_id returning * into v_business;

    -- The official activity card uses this provider name first. Keep it aligned
    -- with the owner-controlled activity record when the platform edits it.
    update public.marketing_provider_profiles p
      set name_ar=trim(p_name),
          name_en=case when nullif(trim(coalesce(p_settings->'catalog_profile'->>'name_en','')),'') is not null
            then trim(p_settings->'catalog_profile'->>'name_en') else p.name_en end,
          description=coalesce(nullif(trim(coalesce(v_business.settings->'catalog_profile'->>'bio','')),''),p.description),
          updated_at=now()
      where p.business_id=v_business.id;
  elsif v_action='DEACTIVATE' then
    update public.businesses set status='INACTIVE',updated_at=now() where id=p_business_id returning * into v_business;
  else
    update public.businesses set status='ACTIVE',updated_at=now() where id=p_business_id returning * into v_business;
  end if;

  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result)
  values(gen_random_uuid()::text,v_business.tenant_id,v_actor,
    case v_action when 'UPDATE' then 'PLATFORM_BUSINESS_UPDATED' when 'DEACTIVATE' then 'PLATFORM_BUSINESS_DEACTIVATED' else 'PLATFORM_BUSINESS_RESTORED' end,
    'business',v_business.id::text,v_old,
    jsonb_build_object('name',v_business.name,'status',v_business.status,'settings',v_business.settings),'SUCCESS');

  return jsonb_build_object('id',v_business.id,'name',v_business.name,'status',v_business.status,'settings',v_business.settings);
end;
$function$;

revoke all on function public.mnty_platform_admin_manage_business(uuid,text,jsonb,text) from public, anon;
grant execute on function public.mnty_platform_admin_manage_business(uuid,text,jsonb,text) to authenticated;
