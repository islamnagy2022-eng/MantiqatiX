create or replace function public.upsert_mnty_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null,
  p_platform text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.push_subscriptions;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(length(trim(p_endpoint)),0) < 20 then raise exception 'INVALID_ENDPOINT'; end if;
  if coalesce(length(trim(p_p256dh)),0) < 20 or coalesce(length(trim(p_auth)),0) < 10 then raise exception 'INVALID_SUBSCRIPTION_KEYS'; end if;

  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,user_agent,platform,enabled,updated_at)
  values(auth.uid(),trim(p_endpoint),trim(p_p256dh),trim(p_auth),left(p_user_agent,500),left(p_platform,100),true,now())
  on conflict (endpoint) do update
    set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,
        platform=excluded.platform,enabled=true,updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.upsert_mnty_push_subscription(text,text,text,text,text) from public, anon;
grant execute on function public.upsert_mnty_push_subscription(text,text,text,text,text) to authenticated;

create or replace function public.disable_mnty_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.push_subscriptions set enabled=false,updated_at=now()
   where endpoint=trim(p_endpoint) and user_id=auth.uid();
end;
$$;

revoke all on function public.disable_mnty_push_subscription(text) from public, anon;
grant execute on function public.disable_mnty_push_subscription(text) to authenticated;