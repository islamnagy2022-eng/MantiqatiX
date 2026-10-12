-- RC522 ACL contract. Run only in disposable PostgreSQL.
do $test$
begin
  if has_table_privilege('anon','public.audit_logs','INSERT')
     or has_table_privilege('anon','public.audit_logs','UPDATE')
     or has_table_privilege('anon','public.audit_logs','DELETE')
     or has_table_privilege('anon','public.audit_logs','TRUNCATE') then
    raise exception 'TEST_FAILED: anon must not write audit history';
  end if;
  if has_table_privilege('authenticated','public.audit_logs','INSERT')
     or has_table_privilege('authenticated','public.audit_logs','UPDATE')
     or has_table_privilege('authenticated','public.audit_logs','DELETE')
     or has_table_privilege('authenticated','public.audit_logs','TRUNCATE') then
    raise exception 'TEST_FAILED: authenticated must not directly write audit history';
  end if;
  if has_table_privilege('service_role','public.audit_logs','UPDATE')
     or has_table_privilege('service_role','public.audit_logs','DELETE')
     or has_table_privilege('service_role','public.audit_logs','TRUNCATE') then
    raise exception 'TEST_FAILED: service_role must not rewrite or truncate audit history';
  end if;
  if not has_table_privilege('service_role','public.audit_logs','INSERT')
     or not has_table_privilege('service_role','public.audit_logs','SELECT') then
    raise exception 'TEST_FAILED: service_role must retain intended insert/read access';
  end if;
end;
$test$;
select 'RC522 audit log API-role append-only ACL: PASS' as result;
