\set ON_ERROR_STOP on

-- Authorized receipt is atomic and replay-safe.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.restaurant_inventory_move('item-a','RECEIPT',5,10,'rc527-receipt-key-000001','توريد اختبار');
select public.restaurant_inventory_move('item-a','RECEIPT',5,10,'rc527-receipt-key-000001','توريد اختبار');
reset role;

do $$ begin
  if (select current_stock_qty from public.restaurant_inventory where id='item-a') <> 15 then
    raise exception 'RC527_FAIL: idempotent receipt changed stock more than once';
  end if;
  if (select count(*) from public.restaurant_inventory_movements where idempotency_key='rc527-receipt-key-000001') <> 1 then
    raise exception 'RC527_FAIL: receipt replay created duplicate ledger rows';
  end if;
end $$;

-- Staff with active branch membership can record a stock issue.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
set role authenticated;
select public.restaurant_inventory_move('item-a','ISSUE',4,0,'rc527-issue-key-0000001','صرف اختبار');
reset role;
do $$ begin
  if (select current_stock_qty from public.restaurant_inventory where id='item-a') <> 11 then
    raise exception 'RC527_FAIL: issue did not atomically decrement stock';
  end if;
  if (select unit_cost_egp from public.restaurant_inventory_movements where idempotency_key='rc527-issue-key-0000001') <> 6 then
    raise exception 'RC527_FAIL: issue cost was not derived from the server-side weighted average';
  end if;
end $$;

-- Direct authenticated balance/cost changes and non-zero initial stock must be blocked.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$ begin
  begin
    update public.restaurant_inventory set current_stock_qty=777 where id='item-a';
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when raise_exception then
    if sqlerrm = 'RC527_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
  begin
    insert into public.restaurant_inventory
      (id,owner_user_id,name_ar,unit,current_stock_qty,min_stock_alert_threshold,unit_cost_egp,supplier_name,tenant_id,business_id,branch_id)
    values ('item-direct','10000000-0000-0000-0000-000000000001','تجاوز مباشر','KG',5,0,10,'','tenant-a','20000000-0000-0000-0000-000000000001','branch-a');
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when raise_exception then
    if sqlerrm = 'RC527_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select current_stock_qty from public.restaurant_inventory where id='item-a') <> 11 then
    raise exception 'RC527_FAIL: direct balance update bypassed the movement ledger';
  end if;
  if exists (select 1 from public.restaurant_inventory where id='item-direct') then
    raise exception 'RC527_FAIL: direct non-zero stock insert bypassed the movement ledger';
  end if;
end $$;


-- Insufficient stock must fail without changing the balance.
set role authenticated;
do $$ begin
  begin
    perform public.restaurant_inventory_move('item-a','ISSUE',999,0,'rc527-insuff-key-00001','صرف زائد');
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when raise_exception then
    if sqlerrm = 'RC527_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select current_stock_qty from public.restaurant_inventory where id='item-a') <> 11 then
    raise exception 'RC527_FAIL: rejected issue changed stock';
  end if;
end $$;

-- Reusing a key with a different payload must fail closed.
set role authenticated;
do $$ begin
  begin
    perform public.restaurant_inventory_move('item-a','RECEIPT',6,10,'rc527-receipt-key-000001','payload مختلف');
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when raise_exception then
    if sqlerrm = 'RC527_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end $$;
reset role;

-- Opening balance is permitted once for an empty item and is auditable.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.restaurant_inventory_move('item-empty','OPENING_BALANCE',3,7.25,'rc527-opening-key-000001','رصيد افتتاحي');
do $$ begin
  begin
    perform public.restaurant_inventory_move('item-empty','OPENING_BALANCE',1,7.25,'rc527-opening-key-000002','رصيد افتتاحي ثان');
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when raise_exception then
    if sqlerrm = 'RC527_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select current_stock_qty from public.restaurant_inventory where id='item-empty') <> 3 then
    raise exception 'RC527_FAIL: opening balance was not recorded exactly once';
  end if;
end $$;

-- A different tenant cannot mutate another branch's item.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
set role authenticated;
do $$ begin
  begin
    perform public.restaurant_inventory_move('item-a','RECEIPT',1,1,'rc527-cross-scope-key-001','محاولة خارج النطاق');
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when raise_exception then
    if sqlerrm = 'RC527_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if (select current_stock_qty from public.restaurant_inventory where id='item-a') <> 11 then
    raise exception 'RC527_FAIL: cross-scope attempt changed stock';
  end if;
end $$;

-- Authenticated clients may read their branch ledger but cannot write it directly.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
do $$ begin
  if exists (select 1 from public.restaurant_inventory_movements where tenant_id='tenant-b') then
    raise exception 'RC527_FAIL: movement RLS exposed another tenant';
  end if;
  begin
    insert into public.restaurant_inventory_movements
      (inventory_id,tenant_id,business_id,branch_id,movement_type,quantity,unit_cost_egp,idempotency_key,notes,created_by)
    values ('item-a','tenant-a','20000000-0000-0000-0000-000000000001','branch-a','RECEIPT',1,1,'rc527-direct-write-key-01','direct write','10000000-0000-0000-0000-000000000001');
    raise exception 'RC527_EXPECTED_FAILURE_NOT_RAISED';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

select 'RC527_RESTAURANT_INVENTORY_MOVEMENT_PASS' as result;
