create schema if not exists private;
grant usage on schema private to authenticated;
grant execute on function private.upsert_mnty_push_subscription(text,text,text,text,text) to authenticated;
grant execute on function private.disable_mnty_push_subscription(text) to authenticated;