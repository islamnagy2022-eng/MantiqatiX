create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text,
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_enabled_idx on public.push_subscriptions(enabled) where enabled = true;

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions
for select to authenticated using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions
for delete to authenticated using (user_id = auth.uid());

create or replace function public.get_mnty_push_secrets()
returns table(vapid_private_key text, webhook_secret text)
language sql
security definer
set search_path = public
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_vapid_private_key' limit 1),
    (select decrypted_secret from vault.decrypted_secrets where name = 'mnty_push_webhook_secret' limit 1);
$$;

revoke all on function public.get_mnty_push_secrets() from public, anon, authenticated;
grant execute on function public.get_mnty_push_secrets() to service_role;

create or replace function public.mnty_push_notification_hook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hook_secret text;
begin
  select decrypted_secret into hook_secret
  from vault.decrypted_secrets
  where name = 'mnty_push_webhook_secret'
  limit 1;

  if hook_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := 'https://moyhiluyhjsujhwlyeuu.supabase.co/functions/v1/mnty-push-dispatch',
    body := to_jsonb(new),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-mnty-push-secret', hook_secret
    ),
    timeout_milliseconds := 2000
  );

  return new;
exception when others then
  raise warning 'MantiqatiX push dispatch enqueue failed: %', SQLERRM;
  return new;
end;
$$;

revoke all on function public.mnty_push_notification_hook() from public, anon, authenticated;
grant execute on function public.mnty_push_notification_hook() to postgres;

drop trigger if exists mnty_notifications_push_after_insert on public.notifications;
create trigger mnty_notifications_push_after_insert
after insert on public.notifications
for each row execute function public.mnty_push_notification_hook();