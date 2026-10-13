
revoke execute on function public.create_settlement_and_post_journal(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar,uuid,text) from public, anon, authenticated, service_role;
drop function if exists public.create_settlement_and_post_journal(varchar,varchar,varchar,varchar,numeric,numeric,numeric,numeric,varchar,varchar,uuid,text);
