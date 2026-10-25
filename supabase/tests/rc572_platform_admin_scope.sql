-- RC572 regression: tenant/business owners must not satisfy the platform-admin guard.
-- All rows and JWT claims are synthetic and rolled back at the end.
begin;

insert into public.user_memberships
  (id, user_id, tenant_id, role, permissions, status)
values
  ('RC572-OWNER-TEST', '57200000-0000-4000-8000-000000000001', 'RC572-TEST', 'OWNER',
   '{"admin":true,"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-ADMIN-TEST', '57200000-0000-4000-8000-000000000002', 'RC572-TEST', 'ADMIN',
   '{"admin":true,"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-SUPER-TEST', '57200000-0000-4000-8000-000000000003', 'RC572-TEST', 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":true}'::jsonb, 'ACTIVE'),
  ('RC572-SUPER-WEAK-TEST', '57200000-0000-4000-8000-000000000004', 'RC572-TEST', 'SUPER_ADMIN',
   '{"scope":"PLATFORM","full_control":false}'::jsonb, 'ACTIVE');

do $$
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

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000003', true);
  if public.mnty_can_platform_admin() is not true then
    raise exception 'RC572_VALID_PLATFORM_ADMIN_REJECTED';
  end if;

  perform set_config('request.jwt.claim.sub', '57200000-0000-4000-8000-000000000004', true);
  if public.mnty_can_platform_admin() is not false then
    raise exception 'RC572_INCOMPLETE_PLATFORM_SCOPE_ACCEPTED';
  end if;
end;
$$;

rollback;
