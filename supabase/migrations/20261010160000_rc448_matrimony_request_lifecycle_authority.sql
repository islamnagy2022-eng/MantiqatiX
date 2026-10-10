-- RC448: move matrimony request state and contact unlock mutations behind trusted RPCs.
-- Forward-only follow-up to RC447. Do not edit or replay RC447.

do $preflight$
begin
  if exists (
    select 1
    from public.matrimony_requests
    where status in ('PENDING','ACCEPTED_MUTUAL')
    group by from_user_id,to_profile_id
    having count(*) > 1
  ) then
    raise exception 'MATRIMONY_ACTIVE_REQUEST_DUPLICATES_REQUIRE_RECONCILIATION';
  end if;
  if exists (
    select 1 from public.matrimony_contact_unlocks
    group by request_id
    having count(*) > 1
  ) then
    raise exception 'MATRIMONY_DUPLICATE_CONTACT_UNLOCKS_REQUIRE_RECONCILIATION';
  end if;
end;
$preflight$;

create unique index if not exists matrimony_contact_unlocks_request_id_key
  on public.matrimony_contact_unlocks(request_id);

create unique index if not exists matrimony_requests_active_pair_unique
  on public.matrimony_requests(from_user_id,to_profile_id)
  where status in ('PENDING','ACCEPTED_MUTUAL');

create or replace function public.matrimony_create_request_backend(
  p_profile_id uuid,
  p_message_text text default ''
)
returns table(request_id uuid,status text,created_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_sender_verified boolean;
  v_target_owner uuid;
  v_target_verified boolean;
  v_existing public.matrimony_requests%rowtype;
  v_request public.matrimony_requests%rowtype;
  v_message text := coalesce(p_message_text,'');
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean,false) then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_profile_id is null then
    raise exception 'PROFILE_REQUIRED' using errcode='22023';
  end if;
  if pg_catalog.length(v_message)>1000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode='22023';
  end if;

  select p.is_verified into v_sender_verified
  from public.matrimony_profiles p
  where p.owner_user_id=auth.uid()
  for share;
  if not found or v_sender_verified is not true then
    raise exception 'SENDER_PROFILE_NOT_VERIFIED' using errcode='42501';
  end if;

  select p.owner_user_id,p.is_verified
    into v_target_owner,v_target_verified
  from public.matrimony_profiles p
  where p.id=p_profile_id
  for share;
  if not found or v_target_verified is not true then
    raise exception 'PROFILE_NOT_AVAILABLE' using errcode='P0002';
  end if;
  if v_target_owner=auth.uid() then
    raise exception 'SELF_REQUEST_FORBIDDEN' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(auth.uid()::text || ':' || p_profile_id::text,0)
  );

  select r.* into v_existing
  from public.matrimony_requests r
  where r.from_user_id=auth.uid()
    and r.to_profile_id=p_profile_id
    and r.status in ('PENDING','ACCEPTED_MUTUAL')
  order by r.created_at desc,r.id
  limit 1
  for update;
  if found then
    return query select v_existing.id,v_existing.status,v_existing.created_at;
    return;
  end if;

  insert into public.matrimony_requests(from_user_id,to_profile_id,status,message_text)
  values(auth.uid(),p_profile_id, 'PENDING',pg_catalog.btrim(v_message))
  returning * into v_request;

  return query select v_request.id,v_request.status,v_request.created_at;
end;
$function$;

create or replace function public.matrimony_respond_request_backend(
  p_request_id uuid,
  p_accept boolean
)
returns table(request_id uuid,status text)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_request public.matrimony_requests%rowtype;
  v_target_owner uuid;
  v_target_verified boolean;
  v_sender_verified boolean;
  v_desired_status text;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean,false) then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_request_id is null or p_accept is null then
    raise exception 'REQUEST_AND_DECISION_REQUIRED' using errcode='22023';
  end if;

  select r.* into v_request
  from public.matrimony_requests r
  where r.id=p_request_id
  for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode='P0002';
  end if;

  select p.owner_user_id,p.is_verified
    into v_target_owner,v_target_verified
  from public.matrimony_profiles p
  where p.id=v_request.to_profile_id
  for share;
  if not found or v_target_owner is distinct from auth.uid() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if p_accept then
    if v_target_verified is not true then
      raise exception 'PROFILE_NOT_AVAILABLE' using errcode='42501';
    end if;
    select p.is_verified into v_sender_verified
    from public.matrimony_profiles p
    where p.owner_user_id=v_request.from_user_id
    for share;
    if not found or v_sender_verified is not true then
      raise exception 'SENDER_PROFILE_NOT_VERIFIED' using errcode='42501';
    end if;
  end if;

  v_desired_status := case when p_accept then 'ACCEPTED_MUTUAL' else 'REJECTED' end;
  if v_request.status=v_desired_status then
    return query select v_request.id,v_request.status;
    return;
  end if;
  if v_request.status is distinct from 'PENDING' then
    raise exception 'REQUEST_ALREADY_RESOLVED' using errcode='55000';
  end if;

  update public.matrimony_requests r
  set status=v_desired_status
  where r.id=v_request.id
  returning r.* into v_request;

  return query select v_request.id,v_request.status;
end;
$function$;

create or replace function public.matrimony_unlock_contact_backend(p_request_id uuid)
returns table(request_id uuid,unlocked_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_request public.matrimony_requests%rowtype;
  v_target_owner uuid;
  v_target_verified boolean;
  v_sender_verified boolean;
  v_unlocked_at timestamptz;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean,false) then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_REQUIRED' using errcode='22023';
  end if;

  select r.* into v_request
  from public.matrimony_requests r
  where r.id=p_request_id
  for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode='P0002';
  end if;
  if v_request.status is distinct from 'ACCEPTED_MUTUAL' then
    raise exception 'CONTACT_NOT_UNLOCKED' using errcode='42501';
  end if;

  select p.owner_user_id,p.is_verified
    into v_target_owner,v_target_verified
  from public.matrimony_profiles p
  where p.id=v_request.to_profile_id
  for share;
  if not found or v_target_verified is not true then
    raise exception 'PROFILE_NOT_AVAILABLE' using errcode='P0002';
  end if;
  if auth.uid() is distinct from v_request.from_user_id
     and auth.uid() is distinct from v_target_owner then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select p.is_verified into v_sender_verified
  from public.matrimony_profiles p
  where p.owner_user_id=v_request.from_user_id
  for share;
  if not found or v_sender_verified is not true then
    raise exception 'SENDER_PROFILE_NOT_VERIFIED' using errcode='42501';
  end if;

  select u.unlocked_at into v_unlocked_at
  from public.matrimony_contact_unlocks u
  where u.request_id=v_request.id;
  if found then
    return query select v_request.id,v_unlocked_at;
    return;
  end if;

  insert into public.matrimony_contact_unlocks as u(id,request_id)
  values(pg_catalog.gen_random_uuid(),v_request.id)
  returning u.unlocked_at into v_unlocked_at;

  return query select v_request.id,v_unlocked_at;
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
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean,false) then
    raise exception 'AUTH_REQUIRED' using errcode='28000';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_REQUIRED' using errcode='22023';
  end if;

  select r.* into v_request
  from public.matrimony_requests r
  where r.id=p_request_id;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode='P0002';
  end if;
  if v_request.status is distinct from 'ACCEPTED_MUTUAL' then
    raise exception 'CONTACT_NOT_UNLOCKED' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.matrimony_contact_unlocks u
    where u.request_id=v_request.id
  ) then
    raise exception 'CONTACT_NOT_UNLOCKED' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.matrimony_profiles p
    where p.id=v_request.to_profile_id and p.is_verified is true
  ) then
    raise exception 'PROFILE_NOT_AVAILABLE' using errcode='42501';
  end if;

  if auth.uid()=v_request.from_user_id then
    v_target_profile_id:=v_request.to_profile_id;
  elsif exists(
    select 1 from public.matrimony_profiles p
    where p.id=v_request.to_profile_id and p.owner_user_id=auth.uid()
  ) then
    select p.id into v_target_profile_id
    from public.matrimony_profiles p
    where p.owner_user_id=v_request.from_user_id and p.is_verified is true;
  else
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  if v_target_profile_id is null or not exists(
    select 1 from public.matrimony_profiles p
    where p.id=v_target_profile_id and p.is_verified is true
  ) then
    raise exception 'PROFILE_NOT_AVAILABLE' using errcode='P0002';
  end if;
  if not exists(
    select 1 from public.matrimony_profiles p
    where p.owner_user_id=v_request.from_user_id and p.is_verified is true
  ) then
    raise exception 'SENDER_PROFILE_NOT_VERIFIED' using errcode='42501';
  end if;

  return query
    select p.id,p.pseudonym,p.wali_contact_name,p.wali_contact_phone,p.direct_contact_phone
    from public.matrimony_profiles p
    where p.id=v_target_profile_id;
end;
$function$;

-- Clients can read requests according to existing RLS, but cannot set status or forge unlock rows.
revoke insert,update,delete on public.matrimony_requests from public,anon,authenticated;
grant select on public.matrimony_requests to authenticated;
revoke insert,update,delete on public.matrimony_contact_unlocks from public,anon,authenticated;
grant select on public.matrimony_contact_unlocks to authenticated;

revoke all on function public.matrimony_create_request_backend(uuid,text) from public,anon,authenticated;
grant execute on function public.matrimony_create_request_backend(uuid,text) to authenticated;
revoke all on function public.matrimony_respond_request_backend(uuid,boolean) from public,anon,authenticated;
grant execute on function public.matrimony_respond_request_backend(uuid,boolean) to authenticated;
revoke all on function public.matrimony_unlock_contact_backend(uuid) from public,anon,authenticated;
grant execute on function public.matrimony_unlock_contact_backend(uuid) to authenticated;
revoke all on function public.matrimony_get_unlocked_contact_backend(uuid) from public,anon,authenticated;
grant execute on function public.matrimony_get_unlocked_contact_backend(uuid) to authenticated;
