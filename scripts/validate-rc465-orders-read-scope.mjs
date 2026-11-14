import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20261114010000_rc465_orders_read_scope_hardening.sql', 'utf8');
const fixture = fs.readFileSync('supabase/tests/rc465_orders_read_scope_fixture.sql', 'utf8');
const baseline = fs.readFileSync('supabase/tests/rc465_orders_read_scope_baseline.sql', 'utf8');
const integration = fs.readFileSync('supabase/tests/rc465_orders_read_scope_integration.sql', 'utf8');
const aclOverlay = fs.readFileSync('supabase/tests/baselines/production_live_order_status_history_acl_overlay_fixture.sql', 'utf8');
const replayWorkflow = fs.readFileSync('.github/workflows/forward-migration-chain-replay.yml', 'utf8');

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

assert.match(migration, /to_regclass\('public\.order_status_history'\)/, 'order history must be a preflight dependency');
assert.match(migration, /order_status_history', 'SELECT'/, 'existing history read grant must be preserved without widening writes');
assert.match(migration, /RC465_UNEXPECTED_HISTORY_CLIENT_WRITE_GRANT/, 'migration must fail closed if client write grants appear on order history');
assert.match(aclOverlay, /TEST-ONLY overlay/, 'forward replay ACL overlay must be explicitly test-only');
assert.match(aclOverlay, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER/, 'replay must restore the live read-only order-history ACL');
assert.ok(aclOverlay.includes('GRANT SELECT ON TABLE public.order_status_history TO authenticated'), 'replay must preserve authenticated history reads');
assert.ok(replayWorkflow.includes('production_live_order_status_history_acl_overlay_fixture.sql'), 'forward replay workflow must include the live ACL overlay');
assert.ok(replayWorkflow.indexOf('RESTORE_TEST_ONLY_KNOWN_LIVE_ORDER_HISTORY_ACL_OVERLAY') < replayWorkflow.indexOf('REPLAY_MIGRATION=$filename'), 'live order-history ACL overlay must run before RC465');
assert.match(migration, /has_table_privilege\('authenticated', 'public\.order_status_history', 'INSERT'\)/, 'migration must explicitly preserve read-only history grants');
for (const restrictiveGuard of ['authenticated_sessions_only', 'deny_anonymous_users', 'mnt_non_anonymous_boundary', 'non_anonymous_authenticated_guard']) {
  assert.doesNotMatch(migration, new RegExp('DROP POLICY IF EXISTS ' + restrictiveGuard + ' ON public\\.order_status_history'), 'restrictive anonymous-session guard must be preserved: ' + restrictiveGuard);
  assert.match(fixture, new RegExp('CREATE POLICY ' + restrictiveGuard + '[\\s\\S]*?AS RESTRICTIVE FOR ALL TO authenticated'), 'fixture must model the restrictive guard: ' + restrictiveGuard);
}
const historyReadPolicy = migration.slice(migration.indexOf('CREATE POLICY order_status_history_member_read'), migration.indexOf('DROP POLICY order_status_history_customer_select_own'));
assert.ok(historyReadPolicy.includes('FROM public.orders o'), 'history reads must be tied to the parent order');
assert.ok(historyReadPolicy.includes('o.business_id = order_status_history.business_id'), 'history reads must match the parent business');
assert.ok(historyReadPolicy.includes('o.branch_id IS NOT DISTINCT FROM order_status_history.branch_id'), 'history reads must match the exact parent branch');
const historyCustomerPolicy = migration.slice(migration.indexOf('CREATE POLICY order_status_history_customer_select_own'), migration.indexOf('DROP POLICY order_status_history_manager_insert'));
assert.ok(historyCustomerPolicy.includes('o.customer_id = auth.uid()'), 'customer history reads must remain limited to their own orders');
const historyInsertPolicy = migration.slice(migration.indexOf('CREATE POLICY order_status_history_manager_insert'), migration.indexOf('COMMENT ON POLICY order_status_history_member_read'));
assert.ok(historyInsertPolicy.includes('um.business_id = order_status_history.business_id'), 'future manager history writes must match the exact business');
assert.ok(historyInsertPolicy.includes('um.branch_id IS NOT DISTINCT FROM order_status_history.branch_id'), 'future manager history writes must match the exact branch');

assert.ok(fixture.includes('CREATE TABLE public.order_status_history'), 'fixture must include order history rows');
assert.ok(fixture.includes('CREATE POLICY authenticated_sessions_only') && fixture.includes('ON public.order_status_history AS RESTRICTIVE FOR ALL'), 'fixture must preserve the live restrictive anonymous-session guard');
assert.match(fixture, /CREATE POLICY order_status_history_member_read/i, 'fixture must reproduce the legacy tenant-only history policy');
assert.match(baseline, /public\.order_status_history/, 'baseline must demonstrate tenant-wide history exposure');
assert.match(integration, /order_status_history/, 'integration tests must exercise order history');
for (const scenario of [
  'unscoped OWNER history visibility',
  'scoped OWNER read sibling order history',
  'BUSINESS_OWNER read sibling order history',
  'branch MANAGER read sibling order history',
  'branch provider read sibling order history',
  'inactive member received order history',
  'customer history must follow own orders',
  'anonymous session received order history'
]) assert.ok(integration.includes(scenario), 'integration test must cover ' + scenario);

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

console.log('RC465_ORDER_AND_HISTORY_READ_SCOPE_STATIC=PASS');
