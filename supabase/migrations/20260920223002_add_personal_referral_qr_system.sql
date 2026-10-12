
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code varchar(32) not null unique,
  status varchar(20) not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  referral_code varchar(32) not null,
  referrer_user_id uuid not null references auth.users(id) on delete restrict,
  referred_user_id uuid not null references auth.users(id) on delete restrict,
  status varchar(24) not null default 'REGISTERED' check (status in ('REGISTERED','QUALIFIED','REWARDED','REJECTED')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(referred_user_id)
);

create index if not exists idx_referral_events_referrer on public.referral_events(referrer_user_id, created_at desc);
create index if not exists idx_referral_events_code on public.referral_events(referral_code, created_at desc);

alter table public.referral_codes enable row level security;
alter table public.referral_codes force row level security;
alter table public.referral_events enable row level security;
alter table public.referral_events force row level security;

drop policy if exists authenticated_sessions_only on public.referral_codes;
create policy authenticated_sessions_only on public.referral_codes as restrictive for all to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true')
with check (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true');

drop policy if exists authenticated_sessions_only on public.referral_events;
create policy authenticated_sessions_only on public.referral_events as restrictive for all to authenticated
using (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true')
with check (coalesce((auth.jwt()->>'is_anonymous'),'false') <> 'true');

create or replace function public.get_or_create_my_referral_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code varchar(32);
  v_count bigint;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;

  select code into v_code from public.referral_codes where user_id = v_uid and status = 'ACTIVE' limit 1;

  if v_code is null then
    v_code := upper(substr(md5(gen_random_uuid()::text || v_uid::text), 1, 10));
    insert into public.referral_codes(user_id, code) values (v_uid, v_code)
    on conflict (user_id) do update set updated_at = now()
    returning code into v_code;
  end if;

  select count(*) into v_count from public.referral_events where referrer_user_id = v_uid and status <> 'REJECTED';

  return jsonb_build_object(
    'code', v_code,
    'inviteUrl', 'https://mantiqatix.com/join/' || v_code,
    'referralsCount', coalesce(v_count,0)
  );
end;
$$;

create or replace function public.claim_referral(p_code varchar)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ref public.referral_codes%rowtype;
  v_existing uuid;
begin
  if v_uid is null or coalesce((auth.jwt()->>'is_anonymous'),'false') = 'true' then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_ref from public.referral_codes
  where code = upper(trim(p_code)) and status = 'ACTIVE'
  limit 1;

  if v_ref.id is null then
    raise exception 'INVALID_REFERRAL_CODE';
  end if;

  if v_ref.user_id = v_uid then
    raise exception 'SELF_REFERRAL_NOT_ALLOWED';
  end if;

  select id into v_existing from public.referral_events where referred_user_id = v_uid limit 1;
  if v_existing is not null then
    return jsonb_build_object('accepted', false, 'reason', 'ALREADY_CLAIMED');
  end if;

  insert into public.referral_events(
    referral_code_id, referral_code, referrer_user_id, referred_user_id
  ) values (
    v_ref.id, v_ref.code, v_ref.user_id, v_uid
  )
  on conflict (referred_user_id) do nothing;

  return jsonb_build_object('accepted', true, 'code', v_ref.code);
end;
$$;

revoke all on function public.get_or_create_my_referral_profile() from public, anon;
grant execute on function public.get_or_create_my_referral_profile() to authenticated;
revoke all on function public.claim_referral(varchar) from public, anon;
grant execute on function public.claim_referral(varchar) to authenticated;

drop policy if exists referral_codes_self_read on public.referral_codes;
create policy referral_codes_self_read on public.referral_codes for select to authenticated
using (user_id = auth.uid());

drop policy if exists referral_events_self_read on public.referral_events;
create policy referral_events_self_read on public.referral_events for select to authenticated
using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());
