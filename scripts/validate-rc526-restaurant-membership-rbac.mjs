import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261022100000_rc526_restaurant_membership_rbac_policies.sql', 'utf8');
const stockSql = fs.readFileSync('supabase/migrations/20261022110000_rc527_restaurant_inventory_movement_ledger.sql', 'utf8');
const stockTest = fs.readFileSync('supabase/tests/rc527_restaurant_inventory_movement_integration.sql', 'utf8');
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
assert.ok(stockSql.includes('alter table public.restaurant_inventory_movements force row level security'),
  'movement ledger must force row-level security');
assert.ok(stockSql.includes('security definer') && stockSql.includes('set search_path = public, pg_temp'),
  'movement RPC must use a fixed search path');
assert.ok(stockSql.includes('pg_advisory_xact_lock') && stockSql.includes('idempotency_key'),
  'movement RPC must serialize idempotency keys');
assert.ok(stockSql.includes("raise exception 'Insufficient inventory stock'"),
  'stock issue must reject negative inventory');
assert.ok(stockSql.includes('grant execute on function public.restaurant_inventory_move(text,text,numeric,numeric,text,text) to authenticated'),
  'authenticated callers must use the explicitly granted movement RPC');
for (const check of ['RC527_FAIL: idempotent receipt changed stock more than once','RC527_FAIL: rejected issue changed stock','RC527_FAIL: cross-scope attempt changed stock','RC527_FAIL: movement RLS exposed another tenant']) {
  assert.ok(stockTest.includes(check), 'integration test must cover ' + check);
}
assert.ok(ui.includes("sb.rpc('restaurant_inventory_move'"), 'UI must use the audited movement RPC');
assert.ok(ui.includes('data-inv-history'), 'UI must expose the movement history');
assert.ok(ui.includes("['OWNER','ADMIN','BUSINESS_OWNER','PROVIDER_OWNER','PROVIDER_ADMIN'].includes(role)"), 'opening-balance UI must be restricted to authorized roles');
assert.ok(stockTest.includes('RC527_FAIL: issue cost was not derived from the server-side weighted average'), 'integration test must verify server-side issue valuation');

console.log('RC526/RC527 restaurant RBAC and inventory movement contracts PASS');
