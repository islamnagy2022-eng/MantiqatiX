-- RC463 forward-only Production alignment.
-- The historical RC463 migration (20261031100000) is retained unchanged for
-- chronological replay from the older captured checkpoint. Production has
-- later live ledger versions, so this migration reapplies the exact hardening
-- as a new, monotonic migration after the current live ledger.
--
-- Scope is deliberately limited to two already-existing trigger-only
-- SECURITY DEFINER functions. No function body, trigger definition, row,
-- business membership, or commission record is modified.

do $preflight$
declare
  r record;
  v_function oid;
begin
  for r in
    select *
    from (values
      ('public.assign_default_owner_to_unowned_business()', 'trg_assign_default_owner_to_unowned_business', 'public.businesses'),
      ('public.capture_commission_rule_audit()', 'trg_commission_rules_audit', 'public.commission_rules')
    ) as expected(signature, trigger_name, relation_name)
  loop
    v_function := pg_catalog.to_regprocedure(r.signature)::oid;

    if v_function is null then
      raise exception 'RC463_FORWARD_FUNCTION_MISSING: %', r.signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and p.prorettype = 'trigger'::regtype
    ) then
      raise exception 'RC463_FORWARD_FUNCTION_NOT_SECURITY_DEFINER_TRIGGER: %', r.signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgname = r.trigger_name
        and t.tgrelid = r.relation_name::regclass
        and t.tgfoid = v_function
        and not t.tgisinternal
        and t.tgenabled = 'O'
    ) then
      raise exception 'RC463_FORWARD_EXPECTED_TRIGGER_MISSING_DISABLED_OR_MISMATCHED: %', r.signature;
    end if;
  end loop;
end;
$preflight$;

alter function public.assign_default_owner_to_unowned_business() set search_path = '';
alter function public.capture_commission_rule_audit() set search_path = '';

revoke all on function public.assign_default_owner_to_unowned_business()
  from public, anon, authenticated, service_role;
revoke all on function public.capture_commission_rule_audit()
  from public, anon, authenticated, service_role;

do $verify$
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
      raise exception 'RC463_FORWARD_VERIFICATION_FUNCTION_MISSING: %', v_signature;
    end if;

    if pg_catalog.has_function_privilege('anon', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('authenticated', v_function, 'EXECUTE')
       or pg_catalog.has_function_privilege('service_role', v_function, 'EXECUTE') then
      raise exception 'RC463_FORWARD_TRIGGER_FUNCTION_STILL_EXECUTABLE_BY_API_ROLE: %',
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
      raise exception 'RC463_FORWARD_TRIGGER_FUNCTION_STILL_EXECUTABLE_BY_PUBLIC: %',
        v_function::regprocedure;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and p.proconfig @> array['search_path=""']
    ) then
      raise exception 'RC463_FORWARD_TRIGGER_FUNCTION_SEARCH_PATH_NOT_EMPTY: %',
        v_function::regprocedure;
    end if;
  end loop;
end;
$verify$;

-- Reconfirm both trigger attachments after the function ACL changes.
do $trigger_verify$
begin
  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgname = 'trg_assign_default_owner_to_unowned_business'
      and t.tgrelid = 'public.businesses'::regclass
      and t.tgfoid = 'public.assign_default_owner_to_unowned_business()'::regprocedure
      and not t.tgisinternal
      and t.tgenabled = 'O'
  ) then
    raise exception 'RC463_FORWARD_DEFAULT_OWNER_TRIGGER_NOT_PRESERVED';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger t
    where t.tgname = 'trg_commission_rules_audit'
      and t.tgrelid = 'public.commission_rules'::regclass
      and t.tgfoid = 'public.capture_commission_rule_audit()'::regprocedure
      and not t.tgisinternal
      and t.tgenabled = 'O'
  ) then
    raise exception 'RC463_FORWARD_COMMISSION_AUDIT_TRIGGER_NOT_PRESERVED';
  end if;
end;
$trigger_verify$;
