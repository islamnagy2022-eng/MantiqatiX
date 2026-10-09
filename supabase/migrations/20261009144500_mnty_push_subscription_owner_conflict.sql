-- Prevent a caller from taking over a push endpoint registered to another user.
-- Existing ownership is immutable; same-user refreshes remain supported.
create or replace function private.upsert_mnty_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.push_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if coalesce(pg_catalog.length(pg_catalog.bpg_catalog.btrim(p_endpoint)), 0) < 20 then
    raise exception 'INVALID_ENDPOINT' using errcode = '22023';
  end if;

  if coalesce(pg_catalog.length(pg_catalog.bpg_catalog.btrim(p_p256dh)), 0) < 20
     or coalesce(pg_catalog.length(pg_catalog.bpg_catalog.btrim(p_auth)), 0) < 10 then
    raise exception 'INVALID_SUBSCRIPTION_KEYS' using errcode = '22023';
  end if;

  insert into public.push_subscriptions as current_subscription
    (user_id, endpoint, p256dh, auth, user_agent, platform, enabled, updated_at)
  values
    (auth.uid(), pg_catalog.btrim(p_endpoint), pg_catalog.btrim(p_p256dh), pg_catalog.btrim(p_auth),
     pg_catalog.left(p_user_agent, 500), pg_catalog.left(p_platform, 100), true, pg_catalog.now())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        platform = excluded.platform,
        enabled = true,
        updated_at = pg_catalog.now()
    where current_subscription.user_id = auth.uid()
  returning * into v_row;

  if not found then
    raise exception 'PUSH_ENDPOINT_OWNERSHIP_CONFLICT'
      using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- Keep the established public wrapper and grants; only the private implementation changes.
