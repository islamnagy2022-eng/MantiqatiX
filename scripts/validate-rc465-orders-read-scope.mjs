import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20261114010000_rc465_orders_read_scope_hardening.sql', 'utf8');
const fixture = fs.readFileSync('supabase/tests/rc465_orders_read_scope_fixture.sql', 'utf8');
const baseline = fs.readFileSync('supabase/tests/rc465_orders_read_scope_baseline.sql', 'utf8');
const integration = fs.readFileSync('supabase/tests/rc465_orders_read_scope_integration.sql', 'utf8');

assert.match(migration, /^BEGIN;/m, 'migration must be transactional');
assert.match(migration, /^COMMIT;/m, 'migration must commit');
assert.match(migration, /orders_customer_select_own/, 'customer-owned cross-tenant read policy must remain a preflight dependency');
assert.match(migration, /relrowsecurity/, 'migration must fail closed if RLS is disabled');
assert.match(migration, /has_table_privilege\('authenticated', 'public\.orders', 'SELECT'\)/, 'existing authenticated read-only order grant must be present');
assert.match(migration, /upper\(m\.role\) IN \('OWNER', 'ADMIN'\)[\s\S]*?m\.business_id IS NULL[\s\S]*?m\.branch_id IS NULL/, 'tenant-wide access must require fully unscoped OWNER/ADMIN');
assert.match(migration, /m\.business_id = orders\.business_id/, 'scoped memberships must match the order business');
assert.match(migration, /m\.branch_id IS NOT DISTINCT FROM orders\.branch_id/, 'scoped memberships must match the exact branch');
assert.match(migration, /'BUSINESS_OWNER'/, 'BUSINESS_OWNER role must be included in its scoped access contract');
assert.match(migration, /mp\.business_id IS NULL OR mp\.business_id = orders\.business_id/, 'assigned partners must not escape business scope');
assert.match(migration, /mp\.branch_id IS NULL OR mp\.branch_id = orders\.branch_id/, 'assigned partners must not escape branch scope');
assert.match(migration, /m\.branch_id IS NULL OR m\.branch_id = orders\.branch_id/, 'branch-scoped service providers must remain within their branch');
assert.doesNotMatch(migration, /^\s*(?:GRANT|REVOKE|ALTER TABLE|INSERT INTO|UPDATE\s+public\.orders|DELETE FROM)\b/im, 'migration must not change grants, table structure, or order data');
assert.doesNotMatch(migration, /DROP POLICY orders_customer_select_own/i, 'customer-owned order visibility must not be removed');

assert.match(fixture, /ALTER TABLE public\.orders ENABLE ROW LEVEL SECURITY/i);
assert.match(fixture, /CREATE POLICY orders_member_select/i);
assert.match(fixture, /CREATE POLICY orders_customer_select_own/i);
assert.match(baseline, /v_visible_count <> 6/, 'baseline must prove the old tenant-wide read behavior');
for (const scenario of [
  'unscoped OWNER',
  'scoped OWNER',
  'BUSINESS_OWNER',
  'branch-scoped MANAGER',
  'Business-scoped (branch NULL)',
  'Service provider',
  'Inactive membership',
  'Customer-owned reads',
  'Anonymous sessions'
]) assert.ok(integration.toLowerCase().includes(scenario.toLowerCase()), `integration test must cover ${scenario}`);

console.log('RC465_ORDER_READ_SCOPE_STATIC=PASS (27 assertions)');
