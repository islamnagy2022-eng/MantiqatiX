-- RC572 regression: tenant-local roles and malformed JSON must never grant platform administration.
-- All rows and JWT claims are synthetic and rolled back at the end.
begin;

-- The canonical platform tenant is present in production; seed it only if the
-- schema-only replay fixture omitted it. The whole fixture is rolled back.
insert into public.tenants (id, name, code, status)
values ('MNTY-PLATFORM', 'RC572 Platform Test Tenant', 'RC572-PLATFORM', 'ACTIVE')
on conflict (id) do nothing;

insert into public.tenants (id, name, code, status)
values ('RC572-TEST', 'RC572 Disposable Security Test', 'RC572-TEST', 'ACTIVE');

insert into public.user_memberships
  (id, user_id, tenant_id, role, permissions, status)
values
  ('RC572-OWNER-TEST', '57200000-0000-4000-8000-000000000001', 'RC572-TEST', 'OWNER',
   '{"admin":true,"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-ADMIN-TEST', '57200000-0000-4000-8000-000000000002', 'RC572-TEST', 'ADMIN',
   '{"admin":true,"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-SUPER-TEST', '57200000-0000-4000-8000-000000000003', 'MNTY-PLATFORM', 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-SUPER-WEAK-TEST', '57200000-0000-4000-8000-000000000004', 'MNTY-PLATFORM', 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":false}'::jsonb, 'ACTIVE'),
  ('RC572-TENANT-SUPER-TEST', '57200000-0000-4000-8000-000000000005', 'RC572-TEST', 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-SUPER-MALFORMED-TEST', '57200000-0000-4000-8000-000000000006', 'MNTY-PLATFORM', 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":"not-a-boolean"}'::jsonb, 'ACTIVE');

do $$
declare
  v_allowed boolean;
begin
  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000001', true);
  if public.mnty_can('admin', null, null, null) is not true then
    raise exception 'RC572_FIXTURE_EXPECTATION_FAILED: owner no longer reproduces legacy generic-admin permission';
  end if;
  if public.mnty_can_platform_admin() is not false then
    raise exception 'RC572_OWNER_ESCALATION: OWNER was accepted as platform admin';
  end if;

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000002', true);
  if public.mnty_can_platform_admin() is not false then
    raise exception 'RC572_ADMIN_ESCALATION: tenant ADMIN was accepted as platform admin';
  end if;

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000005', true);
  if public.mnty_can_platform_admin() is not false then
    raise exception 'RC572_TENANT_SUPER_ADMIN_ESCALATION: tenant-local SUPER_ADMIN was accepted';
  end if;

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000004', true);
  if public.mnty_can_platform_admin() is not false then
    raise exception 'RC572_INCOMPLETE_PLATFORM_SCOPE_ACCEPTED';
  end if;

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000006', true);
  begin
    v_allowed := public.mnty_can_platform_admin();
  exception when others then
    raise exception 'RC572_MALFORMED_PERMISSION_RAISED: %', sqlerrm;
  end;
  if v_allowed is distinct from false then
    raise exception 'RC572_MALFORMED_PERMISSION_ACCEPTED';
  end if;

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000003', true);
  if public.mnty_can_platform_admin() is not true then
    raise exception 'RC572_VALID_PLATFORM_ADMIN_REJECTED';
  end if;
end;
$$;

rollback;
\echo 'RC572 platform-admin scope regression: PASS'
