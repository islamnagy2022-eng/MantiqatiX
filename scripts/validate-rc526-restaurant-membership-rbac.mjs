import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261022100000_rc526_restaurant_membership_rbac_policies.sql', 'utf8');
const stockSql = fs.readFileSync('supabase/migrations/20261022110000_rc527_restaurant_inventory_movement_ledger.sql', 'utf8');
const stockTest = fs.readFileSync('supabase/tests/rc527_restaurant_inventory_movement_integration.sql', 'utf8');
const reservationSql = fs.readFileSync('supabase/migrations/20261022120000_rc528_restaurant_reservations.sql', 'utf8');
const reservationTest = fs.readFileSync('supabase/tests/rc528_restaurant_reservations_integration.sql', 'utf8');
const ui = fs.readFileSync('web/restaurant-module.js', 'utf8');

assert.ok(sql.includes('create or replace function public.guard_restaurant_row_scope()'),
  'restaurant scope guard trigger function must exist');
assert.ok(sql.includes('new.owner_user_id is distinct from old.owner_user_id'),
  'ordinary updates must not transfer restaurant row ownership');
for (const field of ['tenant_id', 'business_id', 'branch_id']) {
  assert.ok(sql.includes('new.' + field + ' is distinct from old.' + field),
    field + ' must be immutable on ordinary restaurant row updates');
}
for (const table of ['restaurant_menu_items', 'restaurant_tables', 'restaurant_inventory']) {
  assert.ok(sql.includes('create trigger ' + table + '_scope_immutable'),
    table + ' must have the scope immutability trigger');
  for (const operation of ['select', 'insert', 'update']) {
    assert.ok(sql.includes('create policy ' + table + '_membership_' + operation),
      table + ' must define a membership-scoped ' + operation.toUpperCase() + ' policy');
  }
}
assert.ok(sql.includes('as restrictive\nfor all\nto authenticated'),
  'membership scope must remain a restrictive boundary for authenticated sessions');
assert.ok(sql.includes('m.user_id = (select auth.uid())'),
  'membership policies must bind access to the authenticated subject');
assert.ok(ui.includes("select('id,tenant_id,business_id,branch_id,role,status,permissions')"),
  'workspace membership lookup must retrieve the RBAC permission context');
assert.ok(ui.includes("if(!customerName||customerName.length>120)"),
  'order creation must validate customer identity before sending the request');

assert.ok(stockSql.includes('create table if not exists public.restaurant_inventory_movements'),
  'RC527 must create an explicit inventory movement ledger');
assert.equal((stockSql.match(/\bv_cost\s+numeric\(14,2\);/g)||[]).length, 1,
  'RC527 movement function must declare its unit-cost variable exactly once');
assert.ok(stockSql.includes("v_cost := case when v_type = 'ISSUE' then v_item.unit_cost_egp else p_unit_cost_egp end;"),
  'issue cost must be derived from the stored inventory valuation');
assert.ok(stockSql.includes('alter table public.restaurant_inventory_movements force row level security'),
  'movement ledger must force row-level security');
assert.ok(stockSql.includes('create or replace function public.guard_restaurant_inventory_balance()') && stockSql.includes('before insert or update on public.restaurant_inventory'), 'direct client writes must not bypass the movement ledger for stock or valuation');
assert.ok(stockSql.includes("current_user = 'postgres'"), 'only the privileged migration/function owner may change stock balances directly');
assert.ok(stockSql.includes('security definer') && stockSql.includes('set search_path = public, pg_temp'),
  'movement RPC must use a fixed search path');
assert.ok(stockSql.includes('pg_advisory_xact_lock') && stockSql.includes('idempotency_key'),
  'movement RPC must serialize idempotency keys');
assert.ok(stockSql.includes("raise exception 'Insufficient inventory stock'"),
  'stock issue must reject negative inventory');
assert.ok(stockSql.includes('grant execute on function public.restaurant_inventory_move(text,text,numeric,numeric,text,text) to authenticated'),
  'authenticated callers must use the explicitly granted movement RPC');
for (const check of ['RC527_FAIL: idempotent receipt changed stock more than once','RC527_FAIL: rejected issue changed stock','RC527_FAIL: direct balance update bypassed the movement ledger','RC527_FAIL: direct non-zero stock insert bypassed the movement ledger','RC527_FAIL: cross-scope attempt changed stock','RC527_FAIL: movement RLS exposed another tenant']) {
  assert.ok(stockTest.includes(check), 'integration test must cover ' + check);
}
assert.ok(ui.includes("sb.rpc('restaurant_inventory_move'"), 'UI must use the audited movement RPC');
assert.ok(ui.includes("const idempotencyKey='MNTY-REST-STOCK-'+uid()") && ui.includes('p_idempotency_key:idempotencyKey'), 'movement retries within the open dialog must reuse one idempotency key');
assert.ok(ui.includes('data-inv-history'), 'UI must expose the movement history');
assert.ok(ui.includes("['OWNER','ADMIN','BUSINESS_OWNER','PROVIDER_OWNER','PROVIDER_ADMIN'].includes(role)"), 'opening-balance UI must be restricted to authorized roles');
assert.ok(stockTest.includes('RC527_FAIL: issue cost was not derived from the server-side weighted average'), 'integration test must verify server-side issue valuation');

assert.ok(reservationSql.includes('create table if not exists public.restaurant_reservations'), 'RC528 must create the reservation ledger');
assert.ok(reservationSql.includes('alter table public.restaurant_reservations force row level security'), 'reservation rows must force RLS');
assert.ok(reservationSql.includes('pg_advisory_xact_lock(hashtextextended(v_tenant||'), 'reservation idempotency must serialize concurrent retries');
assert.ok(reservationSql.includes("v_phone !~ '^[+0-9()[:space:]-]{7,20}$') then"), 'reservation phone validation must be syntactically complete and bounded');
assert.ok(reservationSql.includes("if coalesce(p_payload->>'guest_count','') !~ '^[0-9]{1,3}$' then"), 'reservation guest count must be validated before casting');
assert.ok(reservationSql.includes("upper(m.role) in ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER','PROVIDER_OWNER','PROVIDER_ADMIN','BRANCH_MANAGER','PROVIDER_OPERATIONS')"), 'reservation create must enforce server-side RBAC');
assert.ok(reservationSql.includes('RESTAURANT_RESERVATION_CREATE_FORBIDDEN'), 'reservation create must reject roles without OPERATIONS:create');
assert.ok(reservationSql.includes('RESTAURANT_RESERVATION_UPDATE_FORBIDDEN'), 'reservation state changes must enforce OPERATIONS:update roles');
assert.equal(reservationSql.split('grant execute on function public.restaurant_reservation_mutate').length - 1, 1, 'reservation migration must not contain duplicate function grants');
assert.ok(reservationTest.includes('RC528_FAIL: staff bypassed reservation create RBAC'), 'reservation integration must cover role-based create denial');
assert.ok(reservationTest.includes('RC528_FAIL: idempotent retry created duplicate reservation'), 'reservation integration must cover idempotency');
assert.ok(reservationTest.includes('RC528_FAIL: reservation RLS exposed another tenant'), 'reservation integration must cover cross-tenant RLS');

console.log('RC526/RC527/RC528 restaurant RBAC, inventory, and reservation contracts PASS');
