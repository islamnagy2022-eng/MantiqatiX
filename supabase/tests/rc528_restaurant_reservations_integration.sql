\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'table_id','table-a','customer_name','Test Guest','customer_phone','01012345678','guest_count',3,
 'starts_at','2026-10-24 12:00:00+00'::timestamptz,'ends_at','2026-10-24 13:00:00+00'::timestamptz,
 'notes','integration','idempotency_key','rc528-reservation-key-001'));
-- Repeat the same key and payload; no duplicate should be created.
select public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'table_id','table-a','customer_name','Test Guest','customer_phone','01012345678','guest_count',3,
 'starts_at','2026-10-24 12:00:00+00'::timestamptz,'ends_at','2026-10-24 13:00:00+00'::timestamptz,
 'notes','integration','idempotency_key','rc528-reservation-key-001'));
-- Reusing an idempotency key with changed payload must fail closed.
do $ begin
 begin
  perform public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
   'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
   'table_id','table-a','customer_name','Test Guest','customer_phone','01012345678','guest_count',4,
   'starts_at','2026-10-24 12:00:00+00'::timestamptz,'ends_at','2026-10-24 13:00:00+00'::timestamptz,
   'notes','integration','idempotency_key','rc528-reservation-key-001'));
  raise exception 'RC528_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC528_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $;

select public.restaurant_reservation_mutate('CONFIRM',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'reservation_id',(select id from public.restaurant_reservations where idempotency_key='rc528-reservation-key-001')));
select public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'table_id','table-a','customer_name','Seated Guest','customer_phone','','guest_count',2,
 'starts_at','2026-10-24 14:00:00+00'::timestamptz,'ends_at','2026-10-24 15:00:00+00'::timestamptz,
 'notes','','idempotency_key','rc528-seated-key-0001'));
select public.restaurant_reservation_mutate('CONFIRM',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'reservation_id',(select id from public.restaurant_reservations where idempotency_key='rc528-seated-key-0001')));
select public.restaurant_reservation_mutate('SEAT',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'reservation_id',(select id from public.restaurant_reservations where idempotency_key='rc528-seated-key-0001')));
select public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'table_id','table-a','customer_name','No Show Guest','customer_phone','','guest_count',2,
 'starts_at','2026-10-24 16:00:00+00'::timestamptz,'ends_at','2026-10-24 17:00:00+00'::timestamptz,
 'notes','','idempotency_key','rc528-noshow-key-001'));
select public.restaurant_reservation_mutate('NO_SHOW',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'reservation_id',(select id from public.restaurant_reservations where idempotency_key='rc528-noshow-key-001')));
reset role;

-- Staff has update permission but not create permission in the shared RBAC contract.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
set role authenticated;
do $ begin
 begin
  perform public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
   'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
   'table_id','table-a','customer_name','Staff Create Forbidden','customer_phone','','guest_count',1,
   'starts_at','2026-10-29 12:00:00+00'::timestamptz,'ends_at','2026-10-29 13:00:00+00'::timestamptz,
   'notes','','idempotency_key','rc528-staff-forbidden-01'));
  raise exception 'RC528_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC528_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $;
reset role;
do $ begin
 if exists(select 1 from public.restaurant_reservations where idempotency_key='rc528-staff-forbidden-01') then
  raise exception 'RC528_FAIL: staff bypassed reservation create RBAC';
 end if;
end $;

do $ begin
 if (select count(*) from public.restaurant_reservations where idempotency_key='rc528-reservation-key-001') <> 1 then
  raise exception 'RC528_FAIL: idempotent retry created duplicate reservation';
 end if;
end $$;

-- An overlapping booking for the same table must fail closed.
set role authenticated;
do $$ begin
 begin
  perform public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
   'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
   'table_id','table-a','customer_name','Overlap','customer_phone','','guest_count',2,
   'starts_at','2026-10-24 12:30:00+00'::timestamptz,'ends_at','2026-10-24 13:30:00+00'::timestamptz,
   'notes','','idempotency_key','rc528-overlap-key-0001'));
  raise exception 'RC528_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC528_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $$;
-- Capacity must be checked against the actual table.
do $$ begin
 begin
  perform public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
   'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
   'table_id','table-a','customer_name','Too Many','customer_phone','','guest_count',5,
   'starts_at','2026-10-26 12:00:00+00'::timestamptz,'ends_at','2026-10-26 13:00:00+00'::timestamptz,
   'notes','','idempotency_key','rc528-capacity-key-001'));
  raise exception 'RC528_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC528_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $$;
reset role;

-- A different tenant cannot reserve the first tenant's table.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
set role authenticated;
do $$ begin
 begin
  perform public.restaurant_reservation_mutate('CREATE',jsonb_build_object(
   'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
   'table_id','table-a','customer_name','Cross tenant','customer_phone','','guest_count',1,
   'starts_at','2026-10-28 12:00:00+00'::timestamptz,'ends_at','2026-10-28 13:00:00+00'::timestamptz,
   'notes','','idempotency_key','rc528-cross-scope-key-01'));
  raise exception 'RC528_EXPECTED_FAILURE_NOT_RAISED';
 exception when raise_exception then
  if sqlerrm='RC528_EXPECTED_FAILURE_NOT_RAISED' then raise; end if;
 end;
end $$;
reset role;

-- The row-level security policy does not expose another tenant's reservations.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
set role authenticated;
do $$ begin
 if exists(select 1 from public.restaurant_reservations where tenant_id='tenant-a') then
  raise exception 'RC528_FAIL: reservation RLS exposed another tenant';
 end if;
end $$;
reset role;

-- Authorized cancellation is an auditable state transition, not a delete.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
set role authenticated;
select public.restaurant_reservation_mutate('CANCEL',jsonb_build_object(
 'tenant_id','tenant-a','business_id','20000000-0000-0000-0000-000000000001','branch_id','branch-a',
 'reservation_id',(select id from public.restaurant_reservations where idempotency_key='rc528-reservation-key-001')));
reset role;
do $$ begin
 if (select status from public.restaurant_reservations where idempotency_key='rc528-reservation-key-001') <> 'CANCELLED' then
  raise exception 'RC528_FAIL: cancellation did not persist';
 end if;
end $$;

select 'RC528_RESTAURANT_RESERVATIONS_PASS' as result;
