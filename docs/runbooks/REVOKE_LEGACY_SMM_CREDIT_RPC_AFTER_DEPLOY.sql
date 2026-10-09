-- RC433 staged post-deployment action. DO NOT run until the new smm-gateway Edge Function
-- is deployed and smoke-tested against the 5-argument idempotent admin-credit RPC.
-- This file is an operator-controlled follow-up, not part of RC432 and must not be auto-applied
-- in the same migration batch as RC432.

begin;

do $guard$
declare
  v_def text;
begin
  if to_regprocedure('public.smm_admin_credit_wallet(uuid,uuid,numeric,text,uuid)') is null then
    raise exception 'RC433 blocked: idempotent 5-argument admin-credit RPC is missing';
  end if;
  select pg_get_functiondef('public.smm_admin_credit_wallet(uuid,uuid,numeric,text,uuid)'::regprocedure)
    into v_def;
  if position('public.smm_admins' in v_def)=0
     or position('IDEMPOTENCY_CONFLICT' in v_def)=0 then
    raise exception 'RC433 blocked: admin allowlist/idempotency contract not found';
  end if;
end;
$guard$;

revoke all on function public.smm_admin_credit_wallet(uuid,uuid,numeric,text) from public,anon,authenticated,service_role;

commit;

-- After execution, verify:
select has_function_privilege('service_role','public.smm_admin_credit_wallet(uuid,uuid,numeric,text)','EXECUTE') as legacy_rpc_service_role_execute,
       has_function_privilege('service_role','public.smm_admin_credit_wallet(uuid,uuid,numeric,text,uuid)','EXECUTE') as idempotent_rpc_service_role_execute;
-- Expected: false, true.
