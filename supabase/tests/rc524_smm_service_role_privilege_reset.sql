-- RC524 least-privilege regression. Run only after disposable RC456 fixture, RC456 migration, and RC524 migration.
do $test$
declare
  t text;
begin
  foreach t in array array[
    'smm_admins','smm_providers','smm_services','smm_orders',
    'smm_wallets','smm_order_events','smm_provider_credentials','smm_wallet_transactions'
  ] loop
    if has_table_privilege('service_role','public.'||t,'TRUNCATE') then
      raise exception 'RC524_FAIL: service_role retains TRUNCATE on %', t;
    end if;
    if has_table_privilege('service_role','public.'||t,'REFERENCES') then
      raise exception 'RC524_FAIL: service_role retains REFERENCES on %', t;
    end if;
    if has_table_privilege('service_role','public.'||t,'TRIGGER') then
      raise exception 'RC524_FAIL: service_role retains TRIGGER on %', t;
    end if;
    if has_table_privilege('service_role','public.'||t,'DELETE') then
      raise exception 'RC524_FAIL: service_role retains DELETE on %', t;
    end if;
    if has_table_privilege('anon','public.'||t,'TRUNCATE')
       or has_table_privilege('authenticated','public.'||t,'TRUNCATE') then
      raise exception 'RC524_FAIL: direct client TRUNCATE unexpectedly granted on %', t;
    end if;
  end loop;

  foreach t in array array['smm_admins','smm_providers','smm_wallets'] loop
    if not has_table_privilege('service_role','public.'||t,'SELECT') then
      raise exception 'RC524_FAIL: required SELECT missing on %', t;
    end if;
    if has_table_privilege('service_role','public.'||t,'INSERT')
       or has_table_privilege('service_role','public.'||t,'UPDATE') then
      raise exception 'RC524_FAIL: excess write privilege on read-only table %', t;
    end if;
  end loop;

  foreach t in array array['smm_services','smm_orders'] loop
    if not has_table_privilege('service_role','public.'||t,'SELECT')
       or not has_table_privilege('service_role','public.'||t,'INSERT')
       or not has_table_privilege('service_role','public.'||t,'UPDATE') then
      raise exception 'RC524_FAIL: required gateway privileges missing on %', t;
    end if;
  end loop;

  if not has_table_privilege('service_role','public.smm_order_events','INSERT') then
    raise exception 'RC524_FAIL: event insert privilege missing';
  end if;
  if has_table_privilege('service_role','public.smm_order_events','SELECT')
     or has_table_privilege('service_role','public.smm_order_events','UPDATE') then
    raise exception 'RC524_FAIL: event access exceeds insert-only boundary';
  end if;

  foreach t in array array['smm_provider_credentials','smm_wallet_transactions'] loop
    if has_table_privilege('service_role','public.'||t,'SELECT')
       or has_table_privilege('service_role','public.'||t,'INSERT')
       or has_table_privilege('service_role','public.'||t,'UPDATE') then
      raise exception 'RC524_FAIL: RPC-only table has direct service_role access: %', t;
    end if;
  end loop;

  foreach t in array array[
    'smm_admins','smm_providers','smm_services','smm_orders',
    'smm_wallets','smm_order_events','smm_provider_credentials','smm_wallet_transactions'
  ] loop
    if has_table_privilege('anon','public.'||t,'SELECT')
       or has_table_privilege('anon','public.'||t,'INSERT')
       or has_table_privilege('anon','public.'||t,'UPDATE')
       or has_table_privilege('anon','public.'||t,'DELETE')
       or has_table_privilege('authenticated','public.'||t,'SELECT')
       or has_table_privilege('authenticated','public.'||t,'INSERT')
       or has_table_privilege('authenticated','public.'||t,'UPDATE')
       or has_table_privilege('authenticated','public.'||t,'DELETE') then
      raise exception 'RC524_FAIL: direct client privilege unexpectedly present on %', t;
    end if;
  end loop;
end;
$test$;

select 'RC524 SMM least-privilege privilege reset: PASS' as result;
