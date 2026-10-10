-- RC456 ACL contract. Run only after the disposable fixture and migration.
do $test$
declare
 t text;
begin
 if not has_table_privilege('service_role','public.smm_admins','SELECT') then raise exception 'RC456_FAIL: service_role cannot read explicit SMM admin allowlist'; end if;
 if not has_table_privilege('service_role','public.smm_providers','SELECT') then raise exception 'RC456_FAIL: service_role cannot read providers'; end if;
 if not has_table_privilege('service_role','public.smm_wallets','SELECT') then raise exception 'RC456_FAIL: service_role cannot read the verified user wallet'; end if;

 foreach t in array array['smm_services','smm_orders'] loop
  if not has_table_privilege('service_role','public.'||t,'SELECT')
     or not has_table_privilege('service_role','public.'||t,'INSERT')
     or not has_table_privilege('service_role','public.'||t,'UPDATE') then
    raise exception 'RC456_FAIL: service_role is missing required read/write privileges on %',t;
  end if;
  if has_table_privilege('service_role','public.'||t,'DELETE') then
    raise exception 'RC456_FAIL: DELETE unexpectedly granted on %',t;
  end if;
 end loop;

 if not has_table_privilege('service_role','public.smm_order_events','INSERT') then raise exception 'RC456_FAIL: order event insert missing'; end if;
 if has_table_privilege('service_role','public.smm_order_events','SELECT')
    or has_table_privilege('service_role','public.smm_order_events','UPDATE')
    or has_table_privilege('service_role','public.smm_order_events','DELETE') then
  raise exception 'RC456_FAIL: order event access exceeds insert-only requirement';
 end if;

 foreach t in array array['smm_admins','smm_providers','smm_services','smm_orders','smm_wallets','smm_order_events'] loop
  if has_table_privilege('anon','public.'||t,'SELECT')
     or has_table_privilege('anon','public.'||t,'INSERT')
     or has_table_privilege('anon','public.'||t,'UPDATE')
     or has_table_privilege('anon','public.'||t,'DELETE')
     or has_table_privilege('authenticated','public.'||t,'SELECT')
     or has_table_privilege('authenticated','public.'||t,'INSERT')
     or has_table_privilege('authenticated','public.'||t,'UPDATE')
     or has_table_privilege('authenticated','public.'||t,'DELETE') then
    raise exception 'RC456_FAIL: direct client privilege unexpectedly present on %',t;
  end if;
 end loop;

 if has_table_privilege('service_role','public.smm_provider_credentials','SELECT')
    or has_table_privilege('service_role','public.smm_provider_credentials','INSERT')
    or has_table_privilege('service_role','public.smm_provider_credentials','UPDATE')
    or has_table_privilege('service_role','public.smm_provider_credentials','DELETE') then
  raise exception 'RC456_FAIL: provider credentials must remain RPC-only';
 end if;
 if has_table_privilege('service_role','public.smm_wallet_transactions','SELECT')
    or has_table_privilege('service_role','public.smm_wallet_transactions','INSERT')
    or has_table_privilege('service_role','public.smm_wallet_transactions','UPDATE')
    or has_table_privilege('service_role','public.smm_wallet_transactions','DELETE') then
  raise exception 'RC456_FAIL: wallet transactions must remain RPC-only';
 end if;
end;
$test$;

select 'RC456 SMM service-role access boundary: PASS' as result;
