-- Forward-only repair: the consolidated RC113-RC116 dependency migration
-- reintroduced the older 300-row business list after RC117. The platform owner
-- screen searches locally and must be able to see every activity.
-- Restore the reviewed RC117 implementation without rewriting history.

create or replace function public.mnty_platform_admin_list_businesses(p_search text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_search text := lower(trim(coalesce(p_search,'')));
begin
  if v_actor is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not exists(select 1 from private.platform_admins pa where pa.user_id=v_actor) then
    raise exception 'PLATFORM_ADMIN_REQUIRED';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',b.id,'tenant_id',b.tenant_id,'name',b.name,'code',b.code,'status',b.status,
      'settings',b.settings,'created_at',b.created_at,
      'memberships',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',m.id,'user_id',m.user_id,'role',m.role,'status',m.status,
          'email',coalesce(u.email,''),'full_name',coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','')
        ) order by m.created_at desc)
        from public.user_memberships m
        left join auth.users u on u.id=m.user_id
        where m.tenant_id=b.tenant_id and m.business_id=b.id
      ),'[]'::jsonb)
    ) order by b.created_at desc)
    from public.businesses b
    where v_search='' or lower(coalesce(b.name,'')) like '%'||v_search||'%'
      or lower(coalesce(b.code,'')) like '%'||v_search||'%'
  ),'[]'::jsonb);
end;
$function$;

revoke all on function public.mnty_platform_admin_list_businesses(text) from public, anon;
grant execute on function public.mnty_platform_admin_list_businesses(text) to authenticated;
