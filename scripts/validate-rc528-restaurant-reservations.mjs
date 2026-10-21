import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('supabase/migrations/20261022120000_rc528_restaurant_reservations.sql','utf8');
const test=fs.readFileSync('supabase/tests/rc528_restaurant_reservations_integration.sql','utf8');
const ui=fs.readFileSync('web/restaurant-module.js','utf8');

assert.ok(sql.includes('create table if not exists public.restaurant_reservations'),'reservation records must be persisted');
assert.ok(sql.includes('alter table public.restaurant_reservations force row level security'),'reservation table must force RLS');
assert.ok(sql.includes('restaurant_reservations_membership_select'),'reservation reads must be membership scoped');
assert.ok(sql.includes('revoke all on table public.restaurant_reservations from public, anon, authenticated'),'clients must not directly mutate reservation rows');
assert.ok(sql.includes('create or replace function public.restaurant_reservation_mutate'),'writes must use the canonical reservation RPC');
assert.ok(sql.includes('for update') && sql.includes('RESTAURANT_TABLE_TIME_CONFLICT'),'table-row locking must serialize availability checks');
assert.ok(sql.includes('idempotency_key') && sql.includes('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_RESERVATION'),'reservation retries must be idempotent and reject key reuse with different payload');
assert.ok(sql.includes('GUEST_COUNT_EXCEEDS_TABLE_CAPACITY'),'guest count must not exceed the table capacity');
assert.ok(sql.includes("v_phone !~ '^[+0-9()[:space:]-]{7,20}
assert.ok(sql.includes("set status='CANCELLED',updated_at=now()"),'cancellation must be a state transition, not a hard delete');
for(const check of [
 'RC528_FAIL: idempotent retry created duplicate reservation',
 'RC528_EXPECTED_FAILURE_NOT_RAISED',
 'RC528_FAIL: reservation RLS exposed another tenant',
 'RC528_FAIL: cancellation did not persist'
]) assert.ok(test.includes(check),'integration test must cover '+check);
assert.ok(ui.includes("sb.rpc('restaurant_reservation_mutate'"),'UI writes must use the reservation RPC');
assert.ok(ui.includes("reservationsQ=reservationsQ.eq('tenant_id',s.tenant_id).eq('business_id',s.business_id).eq('branch_id',s.branch_id)"),'reservation reads must be scoped to the active branch');
assert.ok(ui.includes("if(!Number.isInteger(guestCount)||guestCount<1||guestCount>Number(table.capacity_persons))"),'reservation form must validate guest count against table capacity');
assert.ok(ui.includes('data-reservation-action="CONFIRM"') && ui.includes('data-reservation-action="SEAT"') && ui.includes('data-reservation-action="NO_SHOW"'),'reservation UI must expose guarded confirmation, seating and no-show actions');
assert.ok(ui.includes('data-reservation-cancel'),'UI must expose a scoped cancellation action');
console.log('RC528 restaurant reservation contract PASS');
"),'server-side phone validation must not rely only on the browser');
assert.ok(sql.includes("v_action in ('CONFIRM','SEAT','NO_SHOW')") && sql.includes('INVALID_RESERVATION_TRANSITION'),'reservation state changes must follow an explicit transition graph');
assert.ok(sql.includes("set status='CANCELLED',updated_at=now()"),'cancellation must be a state transition, not a hard delete');
for(const check of [
 'RC528_FAIL: idempotent retry created duplicate reservation',
 'RC528_EXPECTED_FAILURE_NOT_RAISED',
 'RC528_FAIL: reservation RLS exposed another tenant',
 'RC528_FAIL: cancellation did not persist'
]) assert.ok(test.includes(check),'integration test must cover '+check);
assert.ok(ui.includes("sb.rpc('restaurant_reservation_mutate'"),'UI writes must use the reservation RPC');
assert.ok(ui.includes('data-reservation-cancel'),'UI must expose a scoped cancellation action');
console.log('RC528 restaurant reservation contract PASS');
