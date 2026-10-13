-- TEST-ONLY LIVE-DERIVED FUNCTION BASELINE
-- Source: read-only pg_get_functiondef/pg_proc catalog snapshot from Supabase project moyhiluyhjsujhwlyeuu.
-- Snapshot date: 2026-10-13.
-- This is NOT recovered historical creation DDL and MUST NOT be applied to production.
-- Injected only into a fresh disposable replay immediately before migration 20260927033925.
-- Function definition only: the trigger function is never invoked by replay, and this file inserts no rows.
-- The following historical migration remains responsible for revoking direct EXECUTE from PUBLIC/anon/authenticated.

CREATE OR REPLACE FUNCTION public.smm_bootstrap_first_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not exists(select 1 from public.smm_admins) then
   insert into public.smm_admins(user_id) values(new.id) on conflict do nothing;
 end if;
 return new;
end;$function$;
