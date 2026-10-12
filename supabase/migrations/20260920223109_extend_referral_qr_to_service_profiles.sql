
create table if not exists public.business_referral_codes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code varchar(32) not null unique,
  status varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id)
);

create table if not exists public.business_referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.business_referral_codes(id) on delete restrict,
  referral_code varchar(32) not null,
  business_id uuid not null references public.businesses(id) on delete restrict,
  visitor_user_id uuid references auth.users(id) on delete set null,
  event_type varchar(24) not null check (event_type in ('SCAN','VISIT','SIGNUP','LEAD','ORDER')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_business_referral_events_business on public.business_referral_events(business_id,created_at desc);
create index if not exists idx_business_referral_events_code on public.business_referral_events(referral_code,created_at desc);

alter table public.business_referral_codes enable row level security;
alter table public.business_referral_codes force row level security;
alter table public.business_referral_events enable row level security;
alter table public.business_referral_events force row level security;

drop policy if exists authenticated_sessions_only on public.business_referral_codes;
create policy authenticated_sessions_only on public.business_referral_codes as restrictive for all to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true')
with check (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true');

drop policy if exists authenticated_sessions_only on public.business_referral_events;
create policy authenticated_sessions_only on public.business_referral_events as restrictive for all to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true')
with check (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true');

create or replace function public.get_or_create_business_referral_profile(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_tenant varchar;
  v_code varchar(32);
  v_scans bigint;
  v_leads bigint;
  v_orders bigint;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false')='true' then raise exception 'AUTH_REQUIRED'; end if;

  select b.tenant_id into v_tenant
  from public.businesses b
  join public.user_memberships m on m.tenant_id=b.tenant_id and m.business_id=b.id
  where b.id=p_business_id and m.user_id=v_uid and m.status='ACTIVE'
    and upper(m.role) in ('OWNER','ADMIN','MANAGER','BUSINESS_OWNER','SUPER_ADMIN')
  limit 1;

  if v_tenant is null then raise exception 'BUSINESS_ACCESS_DENIED'; end if;

  select code into v_code from public.business_referral_codes
  where business_id=p_business_id and status='ACTIVE' limit 1;

  if v_code is null then
    v_code := upper(substr(md5(gen_random_uuid()::text || p_business_id::text),1,10));
    insert into public.business_referral_codes(business_id,code) values(p_business_id,v_code)
    on conflict (business_id) do update set updated_at=now()
    returning code into v_code;
  end if;

  select count(*) into v_scans from public.business_referral_events where business_id=p_business_id and event_type='SCAN';
  select count(*) into v_leads from public.business_referral_events where business_id=p_business_id and event_type='LEAD';
  select count(*) into v_orders from public.business_referral_events where business_id=p_business_id and event_type='ORDER';

  return jsonb_build_object(
    'businessId',p_business_id,
    'code',v_code,
    'profileUrl','https://mantiqatix.com/business/'||p_business_id::text,
    'inviteUrl','https://mantiqatix.com/join-business/'||v_code,
    'scans',coalesce(v_scans,0),
    'leads',coalesce(v_leads,0),
    'orders',coalesce(v_orders,0)
  );
end;
$$;

create or replace function public.track_business_referral_event(
  p_code varchar,
  p_event_type varchar default 'VISIT',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_ref public.business_referral_codes%rowtype;
begin
  if p_event_type not in ('SCAN','VISIT','SIGNUP','LEAD','ORDER') then raise exception 'INVALID_EVENT_TYPE'; end if;

  select * into v_ref from public.business_referral_codes
  where code=upper(trim(p_code)) and status='ACTIVE' limit 1;

  if v_ref.id is null then raise exception 'INVALID_REFERRAL_CODE'; end if;

  insert into public.business_referral_events(referral_code_id,referral_code,business_id,visitor_user_id,event_type,metadata)
  values(v_ref.id,v_ref.code,v_ref.business_id,v_uid,p_event_type,coalesce(p_metadata,'{}'::jsonb));

  return jsonb_build_object('tracked',true,'businessId',v_ref.business_id,'eventType',p_event_type);
end;
$$;

revoke all on function public.get_or_create_business_referral_profile(uuid) from public,anon,authenticated;
grant execute on function public.get_or_create_business_referral_profile(uuid) to authenticated;

revoke all on function public.track_business_referral_event(varchar,varchar,jsonb) from public,anon,authenticated;
grant execute on function public.track_business_referral_event(varchar,varchar,jsonb) to anon,authenticated;

drop policy if exists business_referral_codes_member_read on public.business_referral_codes;
create policy business_referral_codes_member_read on public.business_referral_codes for select to authenticated
using (exists (
  select 1 from public.user_memberships m
  where m.user_id=auth.uid() and m.business_id=business_referral_codes.business_id and m.status='ACTIVE'
));

drop policy if exists business_referral_events_member_read on public.business_referral_events;
create policy business_referral_events_member_read on public.business_referral_events for select to authenticated
using (exists (
  select 1 from public.user_memberships m
  where m.user_id=auth.uid() and m.business_id=business_referral_events.business_id and m.status='ACTIVE'
));
