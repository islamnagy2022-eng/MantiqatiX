-- RC258 follow-up: consume the centralized platform-admin guard in a sensitive mutation
create or replace function public.admin_create_global_ad(
  p_title varchar,
  p_creative_url text,
  p_target_url text default null,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $function$
declare v_id uuid;
begin
  if not public.mnty_can_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if coalesce(trim(p_title),'')='' or coalesce(trim(p_creative_url),'')='' then
    raise exception 'TITLE_AND_CREATIVE_REQUIRED';
  end if;
  insert into public.platform_global_advertisements(title,creative_url,target_url,status,approval_status,start_at,end_at,created_by)
  values(trim(p_title),trim(p_creative_url),nullif(trim(p_target_url),''),'ACTIVE','APPROVED',p_start_at,p_end_at,auth.uid())
  returning id into v_id;
  return v_id;
end;
$function$;