-- RC103 behavioral integration test. Run only in disposable PostgreSQL.
do $test$
declare
  manager_a uuid := '10000000-0000-4000-8000-000000000001';
  owner_user uuid := '10000000-0000-4000-8000-000000000002';
  other_business_admin uuid := '10000000-0000-4000-8000-000000000004';
  customer_user uuid := '10000000-0000-4000-8000-000000000003';
  tenant_key varchar := 'tenant-a';
  rejected boolean;
  result jsonb;
begin
  -- Manager assigned to branch A may advance an order in branch A.
  perform set_config('request.jwt.claim.sub', manager_a::text, false);
  result := public.update_order_status_backend(
    '30000000-0000-4000-8000-000000000001', tenant_key, manager_a, 'CONFIRMED', null
  );
  if result->>'status' <> 'CONFIRMED' then
    raise exception 'TEST_FAILED: branch A manager could not confirm own-branch order';
  end if;

  -- The same manager must not mutate an order in branch B of the same business.
  rejected := false;
  begin
    perform public.update_order_status_backend(
      '30000000-0000-4000-8000-000000000002', tenant_key, manager_a, 'CONFIRMED', null
    );
  exception when others then
    if sqlerrm <> 'INVALID_ORDER_TRANSITION' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: branch A manager changed branch B order'; end if;
  if (select status from public.orders where id='30000000-0000-4000-8000-000000000002') <> 'PENDING' then
    raise exception 'TEST_FAILED: rejected cross-branch update changed order status';
  end if;

  -- An ADMIN membership scoped to another business must not inherit tenant-wide access.
  perform set_config('request.jwt.claim.sub', other_business_admin::text, false);
  rejected := false;
  begin
    perform public.update_order_status_backend(
      '30000000-0000-4000-8000-000000000002', tenant_key, other_business_admin, 'CONFIRMED', null
    );
  exception when others then
    if sqlerrm <> 'INVALID_ORDER_TRANSITION' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: business-scoped ADMIN changed an unrelated business order'; end if;

  -- Tenant-wide OWNER access remains compatible with the previous contract.
  perform set_config('request.jwt.claim.sub', owner_user::text, false);
  result := public.update_order_status_backend(
    '30000000-0000-4000-8000-000000000002', tenant_key, owner_user, 'CONFIRMED', null
  );
  if result->>'status' <> 'CONFIRMED' then
    raise exception 'TEST_FAILED: tenant-wide OWNER lost branch-wide operational access';
  end if;

  -- A customer may still cancel their own unpaid order without seller membership.
  perform set_config('request.jwt.claim.sub', customer_user::text, false);
  result := public.update_order_status_backend(
    '30000000-0000-4000-8000-000000000003', tenant_key, customer_user, 'CANCELLED', 'customer request'
  );
  if result->>'status' <> 'CANCELLED' then
    raise exception 'TEST_FAILED: customer-owned cancellation path was broken';
  end if;

  -- Paid-order cancellation remains blocked until the refund path is handled.
  rejected := false;
  begin
    perform public.update_order_status_backend(
      '30000000-0000-4000-8000-000000000004', tenant_key, customer_user, 'CANCELLED', null
    );
  exception when others then
    if sqlerrm <> 'ORDER_PAID_REQUIRES_REFUND_BEFORE_CANCELLATION' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: paid order was cancelled without refund handling'; end if;
  if (select status from public.orders where id='30000000-0000-4000-8000-000000000004') <> 'PENDING' then
    raise exception 'TEST_FAILED: paid-order cancellation failure changed order status';
  end if;

  -- Status transitions remain allowlisted.
  perform set_config('request.jwt.claim.sub', manager_a::text, false);
  rejected := false;
  begin
    perform public.update_order_status_backend(
      '30000000-0000-4000-8000-000000000001', tenant_key, manager_a, 'DELIVERED', null
    );
  exception when others then
    if sqlerrm <> 'INVALID_ORDER_TRANSITION' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'TEST_FAILED: invalid status transition was accepted'; end if;
end;
$test$;

select 'RC103 order-status branch scope: PASS' as result;
