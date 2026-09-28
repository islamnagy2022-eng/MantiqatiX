-- RC107: move pg_net out of public schema.
-- Production migration applied as rc107_move_pg_net_to_extensions.

create schema if not exists extensions;
drop extension if exists pg_net;
create extension pg_net with schema extensions;

create or replace function public.mnty_push_notification_hook()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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

  perform extensions.http_post(
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
$function$;
