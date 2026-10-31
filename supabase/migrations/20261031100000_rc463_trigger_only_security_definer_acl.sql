-- RC463: harden trigger-only SECURITY DEFINER functions without changing trigger behavior.
-- Forward-only. Apply only after the disposable PostgreSQL integration passes.
-- These functions are trigger entrypoints, not client or backend RPCs.

do $preflight$
declare
  v_signature text;
  v_function oid;
begin
  foreach v_signature in array array[
    'public.assign_default_owner_to_unowned_business()',
    'public.capture_commission_rule_audit()'
  ] loop
    v_function := pg_catalog.to_regprocedure(v_signature)::oid;
    if v_function is null then
      raise exception 'RC463_REQUIRED_TRIGGER_FUNCTION_MISSING: %', v_signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and p.prorettype = 'trigger'::regtype
    ) then
      raise exception 'RC463_FUNCTION_NOT_SECURITY_DEFINER_TRIGGER: %', v_signature;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgfoid = 'public.assign_default_owner_to_unowned_business()'::regprocedure
      and t.tgrelid = 'public.businesses'::regclass
      and not t.tgisinternal
      and t.tgenabled = 'O'
  ) then
    raise exception 'RC463_DEFAULT_OWNER_TRIGGER_MISSING_OR_DISABLED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgfoid = 'public.capture_commission_rule_audit()'::regprocedure
      and t.tgrelid = 'public.commission_rules'::regclass
      and not t.tgisinternal
      and t.tgenabled = 'O'
  ) then
    raise exception 'RC463_COMMISSION_AUDIT_TRIGGER_MISSING_OR_DISABLED';
  end if;
end;
$preflight$;

-- All referenced application objects in both function bodies are schema-qualified.
-- Pin the definer context so caller-controlled search_path/temp objects cannot shadow names.
alter function public.assign_default_owner_to_unowned_business()
  set search_path = '';
alter function public.capture_commission_rule_audit()
  set search_path = '';

-- Trigger execution does not require callers to retain direct EXECUTE after CREATE TRIGGER.
-- Remove inherited PUBLIC and direct API/backend EXECUTE while preserving the triggers.
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
    if pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'RC463_TRIGGER_FUNCTION_STILL_EXECUTABLE_BY_API_ROLE: %',
        v_function::regprocedure;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_proc p
      cross join lateral pg_catalog.aclexplode(
        coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) a
      where p.oid = v_function
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE'
    ) then
      raise exception 'RC463_TRIGGER_FUNCTION_STILL_EXECUTABLE_BY_PUBLIC: %',
        v_function::regprocedure;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception 'RC463_TRIGGER_FUNCTION_SEARCH_PATH_NOT_EMPTY: %',
        v_function::regprocedure;
    end if;
  end loop;
end;
$verify$;
