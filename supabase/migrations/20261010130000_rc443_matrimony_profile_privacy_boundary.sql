-- RC443: separate public matrimony discovery fields from private owner/contact data.
drop policy if exists matrimony_profiles_select on public.matrimony_profiles;
create policy matrimony_profiles_select
  on public.matrimony_profiles
  for select
  to authenticated
  using (owner_user_id = auth.uid());

create or replace function public.matrimony_discover_profiles_backend(
  p_limit integer default 50,
  p_city text default null,
  p_gender text default null
)
returns table(
  profile_id uuid,
  gender text,
  pseudonym text,
  age integer,
  city text,
  country text,
  nationality text,
  education text,
  occupation text,
  marital_status text,
  compatibility_tags jsonb,
  is_verified boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  return query
    select p.id,p.gender,p.pseudonym,p.age,p.city,p.country,p.nationality,
           p.education,p.occupation,p.marital_status,p.compatibility_tags,p.is_verified,p.created_at
    from public.matrimony_profiles p
    where p.is_verified is true
      and p.owner_user_id <> auth.uid()
      and (p_city is null or pg_catalog.lower(p.city)=pg_catalog.lower(pg_catalog.btrim(p_city)))
      and (p_gender is null or pg_catalog.upper(p.gender)=pg_catalog.upper(pg_catalog.btrim(p_gender)))
    order by p.created_at desc,p.id
    limit GREATEST(1,LEAST(COALESCE(p_limit,50),50));
end;
$function$;

create or replace function public.matrimony_get_unlocked_contact_backend(p_request_id uuid)
returns table(
  profile_id uuid,
  pseudonym text,
  wali_contact_name text,
  wali_contact_phone text,
  direct_contact_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_request public.matrimony_requests%rowtype;
  v_target_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_REQUIRED' using errcode = '22023';
  end if;

  select r.* into v_request
  from public.matrimony_requests r
  where r.id=p_request_id;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.status <> 'ACCEPTED_MUTUAL' then
    raise exception 'CONTACT_NOT_UNLOCKED' using errcode = '42501';
  end if;

  if auth.uid() = v_request.from_user_id then
    v_target_profile_id := v_request.to_profile_id;
  elsif exists (
    select 1 from public.matrimony_profiles p
    where p.id=v_request.to_profile_id and p.owner_user_id=auth.uid()
  ) then
    select p.id into v_target_profile_id
    from public.matrimony_profiles p
    where p.owner_user_id=v_request.from_user_id
    order by p.created_at desc,p.id
    limit 1;
  else
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_target_profile_id is null then
    raise exception 'CONTACT_PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.matrimony_contact_unlocks u
    where u.request_id=v_request.id
  ) then
    raise exception 'CONTACT_NOT_UNLOCKED' using errcode = '42501';
  end if;

  return query
    select p.id,p.pseudonym,p.wali_contact_name,p.wali_contact_phone,p.direct_contact_phone
    from public.matrimony_profiles p
    where p.id=v_target_profile_id;
end;
$function$;

revoke all on function public.matrimony_discover_profiles_backend(integer,text,text) from public,anon;
grant execute on function public.matrimony_discover_profiles_backend(integer,text,text) to authenticated;
revoke all on function public.matrimony_get_unlocked_contact_backend(uuid) from public,anon;
grant execute on function public.matrimony_get_unlocked_contact_backend(uuid) to authenticated;
