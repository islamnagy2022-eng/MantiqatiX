-- RC463: close direct API execution of trigger-only SECURITY DEFINER functions.
-- Forward-only hardening. The intended public targeted-ad discovery RPC is untouched.
--
-- These two functions are invoked only by existing triggers:
--   businesses.trg_assign_default_owner_to_unowned_business
--   commission_rules.trg_commission_rules_audit
-- PostgreSQL checks EXECUTE when a trigger is created/replaced; revoking direct
-- EXECUTE does not disable an already-created trigger. The disposable integration
-- test proves both trigger paths still execute after this migration.

do $preflight$
declare
  v_owner oid := to_regprocedure('public.assign_default_owner_to_unowned_business()');
  v_audit oid := to_regprocedure('public.capture_commission_rule_audit()');
begin
  if v_owner is null or v_audit is null then
    raise exception 'RC463_REQUIRED_TRIGGER_FUNCTION_MISSING';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgfoid = v_owner
      and t.tgrelid = 'public.businesses'::regclass
      and t.tgname = 'trg_assign_default_owner_to_unowned_business'
      and not t.tgisinternal
      and t.tgenabled = 'O'
  ) then
    raise exception 'RC463_DEFAULT_OWNER_TRIGGER_NOT_ENABLED';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger t
    where t.tgfoid = v_audit
      and t.tgrelid = 'public.commission_rules'::regclass
      and t.tgname = 'trg_commission_rules_audit'
      and not t.tgisinternal
      and t.tgenabled = 'O'
  ) then
    raise exception 'RC463_COMMISSION_AUDIT_TRIGGER_NOT_ENABLED';
  end if;

  if not exists (select 1 from pg_catalog.pg_proc p where p.oid = v_owner and p.prosecdef)
     or not exists (select 1 from pg_catalog.pg_proc p where p.oid = v_audit and p.prosecdef) then
    raise exception 'RC463_TRIGGER_FUNCTION_MUST_REMAIN_SECURITY_DEFINER';
  end if;
end;
$preflight$;

alter function public.assign_default_owner_to_unowned_business()
  set search_path = '';
alter function public.capture_commission_rule_audit()
  set search_path = '';

revoke all on function public.assign_default_owner_to_unowned_business()
  from public, anon, authenticated, service_role;
revoke all on function public.capture_commission_rule_audit()
  from public, anon, authenticated, service_role;

do $verify$
declare
  v_function oid;
begin
  foreach v_function in array array[
    'public.assign_default_owner_to_unowned_business()'::regprocedure::oid,
    'public.capture_commission_rule_audit()'::regprocedure::oid
  ] loop
    if has_function_privilege('anon', v_function, 'EXECUTE')
       or has_function_privilege('authenticated', v_function, 'EXECUTE')
       or has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'RC463_DIRECT_API_EXECUTE_REMAINS: %', v_function::regprocedure;
    end if;

    if exists (
      select 1
      from pg_catalog.aclexplode(
        (select p.proacl from pg_catalog.pg_proc p where p.oid = v_function)
      ) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception 'RC463_PUBLIC_EXECUTE_REMAINS: %', v_function::regprocedure;
    end if;

    if not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception 'RC463_EMPTY_SEARCH_PATH_NOT_SET: %', v_function::regprocedure;
    end if;
  end loop;
end;
$verify$;
