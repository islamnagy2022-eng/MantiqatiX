-- RC463: harden the live trigger-only SECURITY DEFINER functions without changing trigger behavior.
-- Forward-only. The two functions are not consistently represented in older
-- captured schema checkpoints; harden each one when its expected trigger exists.
-- If both a function and its trigger are absent in a checkpoint, leave that
-- absent feature untouched. Any partial/mismatched state fails closed.

do $preflight$
declare
  r record;
  v_function oid;
  v_trigger_exists boolean;
begin
  for r in
    select *
    from (values
      ('public.assign_default_owner_to_unowned_business()', 'trg_assign_default_owner_to_unowned_business', 'public.businesses'),
      ('public.capture_commission_rule_audit()', 'trg_commission_rules_audit', 'public.commission_rules')
    ) as expected(signature, trigger_name, relation_name)
  loop
    v_function := pg_catalog.to_regprocedure(r.signature)::oid;
    v_trigger_exists := exists (
      select 1
      from pg_catalog.pg_trigger t
      where t.tgname = r.trigger_name
        and t.tgrelid = r.relation_name::regclass
        and not t.tgisinternal
    );

    if v_function is null and not v_trigger_exists then
      raise notice 'RC463_OPTIONAL_TRIGGER_FEATURE_ABSENT_IN_CHECKPOINT: %', r.signature;
      continue;
    end if;

    if v_function is null or not v_trigger_exists then
      raise exception 'RC463_PARTIAL_TRIGGER_FEATURE_STATE: %', r.signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc p
      where p.oid = v_function
        and p.prosecdef
        and p.prorettype = 'trigger'::regtype
    ) then
      raise exception 'RC463_FUNCTION_NOT_SECURITY_DEFINER_TRIGGER: %', r.signature;
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
      raise exception 'RC463_EXPECTED_TRIGGER_MISSING_DISABLED_OR_MISMATCHED: %', r.signature;
    end if;
  end loop;
end;
$preflight$;

-- All application objects referenced by the observed function bodies are schema-qualified.
-- Pin each present definer function to the empty search_path.
do $harden$
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
      raise notice 'RC463_SKIPPED_ABSENT_TRIGGER_FUNCTION: %', v_signature;
      continue;
    end if;

    execute pg_catalog.format('alter function %s set search_path = %L',
      v_function::regprocedure, '');
    execute pg_catalog.format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_function::regprocedure
    );
  end loop;
end;
$harden$;

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
      raise notice 'RC463_VERIFICATION_SKIPPED_ABSENT_TRIGGER_FUNCTION: %', v_signature;
      continue;
    end if;

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
