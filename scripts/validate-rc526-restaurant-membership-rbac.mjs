import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/migrations/20261022100000_rc526_restaurant_membership_rbac_policies.sql', 'utf8');
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

console.log('RC526 restaurant membership RBAC contract PASS');
