\set ON_ERROR_STOP on
select set_config('request.jwt.claim.role','service_role',false);
do $ begin
 if has_function_privilege('authenticated','public.update_order_status_backend(uuid,character varying,uuid,character varying,text)','EXECUTE') then
  raise exception 'RC529_FAIL: authenticated role can execute backend-only status RPC';
 end if;
end $;
-- Staff may transition an order in their own branch.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role service_role;
select public.update_order_status_backend('30000000-0000-0000-0000-000000000001','tenant-a','10000000-0000-0000-0000-000000000001','CONFIRMED',null);
reset role;
do $$ begin
 if (select status from public.orders where id='30000000-0000-0000-0000-000000000001') <> 'CONFIRMED' then
  raise exception 'RC529_FAIL: valid same-branch transition did not persist';
 end if;
end $$;

-- A staff member in branch A cannot transition an order in branch B of the same business.
set role service_role;
do $$ begin
 begin
  perform public.update_order_status_backend('30000000-0000-0000-0000-000000000002','tenant-a','10000000-0000-0000-0000-000000000001','CONFIRMED',null);
  raise exception 'RC529_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC529_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $$;
-- The restrictive RLS policy must also block direct cross-branch UPDATE attempts.
reset role;
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
update public.orders set status='CONFIRMED' where id='30000000-0000-0000-0000-000000000002';
reset role;
select set_config('request.jwt.claim.role','service_role',false);
do $ begin
 if (select status from public.orders where id='30000000-0000-0000-0000-000000000002') <> 'PENDING' then
  raise exception 'RC529_FAIL: cross-branch status mutation succeeded';
 end if;
end $$;

-- A business-wide owner membership in another business of the same tenant cannot cross businesses.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
set role service_role;
do $$ begin
 begin
  perform public.update_order_status_backend('30000000-0000-0000-0000-000000000001','tenant-a','10000000-0000-0000-0000-000000000003','PREPARING',null);
  raise exception 'RC529_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC529_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $$;
reset role;
do $ begin
 if (select status from public.orders where id='30000000-0000-0000-0000-000000000001') <> 'CONFIRMED' then
  raise exception 'RC529_FAIL: cross-business owner changed order state';
 end if;
end $;

-- Customer cancellation remains possible only for the customer's own unpaid order.
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',false);
set role service_role;
select public.update_order_status_backend('30000000-0000-0000-0000-000000000001','tenant-a','40000000-0000-0000-0000-000000000001','CANCELLED','customer cancellation');
reset role;
do $$ begin
 if (select status from public.orders where id='30000000-0000-0000-0000-000000000001') <> 'CANCELLED' then
  raise exception 'RC529_FAIL: customer cancellation did not persist';
 end if;
end $$;

-- A customer cannot cancel another customer's order, even inside the same tenant.
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',false);
set role service_role;
do $ begin
 begin
  perform public.update_order_status_backend('30000000-0000-0000-0000-000000000002','tenant-a','40000000-0000-0000-0000-000000000001','CANCELLED','cross-customer attempt');
  raise exception 'RC529_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC529_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $;
reset role;
do $ begin
 if (select status from public.orders where id='30000000-0000-0000-0000-000000000002') <> 'PENDING' then
  raise exception 'RC529_FAIL: customer cancelled another customer order';
 end if;
end $;

-- Paid orders still cannot be cancelled without a refund.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role service_role;
do $$ begin
 begin
  perform public.update_order_status_backend('30000000-0000-0000-0000-000000000004','tenant-a','10000000-0000-0000-0000-000000000001','CANCELLED',null);
  raise exception 'RC529_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC529_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if (select status from public.orders where id='30000000-0000-0000-0000-000000000004') <> 'PENDING' then
  raise exception 'RC529_FAIL: paid order was cancelled without refund';
 end if;
end $$;

select 'RC529_ORDER_BRANCH_SCOPE_PASS' as result;
