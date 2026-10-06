-- MantiGO abuse/rate-limit guardrails v1
-- Protect high-cost mutation paths without weakening the existing backend-authoritative model.

create table if not exists public.mantigo_rate_limit_config (
  action text primary key,
  max_events integer not null check (max_events > 0),
  window_minutes integer not null check (window_minutes > 0),
  updated_at timestamptz not null default now()
);

insert into public.mantigo_rate_limit_config(action,max_events,window_minutes)
values
  ('CREATE_RIDE',10,60),
  ('CREATE_BID',30,60)
on conflict (action) do nothing;

alter table public.mantigo_rate_limit_config enable row level security;
revoke all on table public.mantigo_rate_limit_config from anon, authenticated;

drop policy if exists mantigo_rate_limit_config_admin_select on public.mantigo_rate_limit_config;
create policy mantigo_rate_limit_config_admin_select
on public.mantigo_rate_limit_config
for select to authenticated
using ((select public.mnty_can_platform_admin()));

drop policy if exists mantigo_rate_limit_config_admin_update on public.mantigo_rate_limit_config;
create policy mantigo_rate_limit_config_admin_update
on public.mantigo_rate_limit_config
for update to authenticated
using ((select public.mnty_can_platform_admin()))
with check ((select public.mnty_can_platform_admin()));

create or replace function public.mantigo_rate_limit_check(
  p_action text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max integer;
  v_window integer;
  v_count bigint;
begin
  if p_actor is null then
    raise exception using errcode='28000', message='AUTH_REQUIRED';
  end if;

  select max_events, window_minutes
    into v_max, v_window
  from public.mantigo_rate_limit_config
  where action = p_action;

  if v_max is null then
    raise exception using errcode='22023', message='RATE_LIMIT_CONFIG_MISSING';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('MANTIGO_RATE:' || p_action || ':' || p_actor::text, 0)
  );

  if p_action = 'CREATE_RIDE' then
    select count(*) into v_count
    from public.mantigo_rides
    where customer_id = p_actor
      and created_at >= now() - make_interval(mins => v_window);
  elsif p_action = 'CREATE_BID' then
    select count(*) into v_count
    from public.mantigo_bids
    where captain_id = p_actor
      and created_at >= now() - make_interval(mins => v_window);
  else
    raise exception using errcode='22023', message='RATE_LIMIT_ACTION_UNSUPPORTED';
  end if;

  if v_count >= v_max then
    raise exception using errcode='P0001',
      message='RATE_LIMITED',
      detail=json_build_object(
        'action',p_action,
        'max_events',v_max,
        'window_minutes',v_window
      )::text;
  end if;
end;
$$;

revoke all on function public.mantigo_rate_limit_check(text,uuid) from public, anon, authenticated;
grant execute on function public.mantigo_rate_limit_check(text,uuid) to authenticated;

create or replace function public.mantigo_guard_ride_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.mantigo_rate_limit_check('CREATE_RIDE', new.customer_id);
  return new;
end;
$$;

create or replace function public.mantigo_guard_bid_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.mantigo_rate_limit_check('CREATE_BID', new.captain_id);
  return new;
end;
$$;

revoke all on function public.mantigo_guard_ride_rate_limit() from public, anon, authenticated;
revoke all on function public.mantigo_guard_bid_rate_limit() from public, anon, authenticated;

drop trigger if exists mantigo_ride_rate_limit_guard on public.mantigo_rides;
create trigger mantigo_ride_rate_limit_guard
before insert on public.mantigo_rides
for each row execute function public.mantigo_guard_ride_rate_limit();

drop trigger if exists mantigo_bid_rate_limit_guard on public.mantigo_bids;
create trigger mantigo_bid_rate_limit_guard
before insert on public.mantigo_bids
for each row execute function public.mantigo_guard_bid_rate_limit();

comment on table public.mantigo_rate_limit_config is
  'Internal MantiGO abuse-control thresholds. Direct client access denied; backend trigger enforcement only.';
