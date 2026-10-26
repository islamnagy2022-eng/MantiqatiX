import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const html = read('web/demo/connected.html');
const config = read('web/demo/connected-config.js');
const app = read('web/demo/connected.js');
const bootstrap = read('supabase/demo/bootstrap.sql');
const catalog = read('supabase/demo/catalog-functions.sql');
const stock = read('supabase/demo/order-stock-guards.sql');
const hardening = read('supabase/demo/security-hardening.sql');
const hardeningDelta = read('supabase/demo/security-hardening-20261026.sql');

assert.match(html, /connected-config\.js/, 'connected page loads the DEMO-only config');
assert.match(html, /connected\.js/, 'connected page loads the database-backed client');
assert.match(html, /@supabase\/supabase-js@/, 'connected page loads Supabase SDK');
assert.doesNotMatch(html, /src=["'](?:\.\.\/)?config\.js(?:\?|["'])/, 'connected page never loads production config');

assert.match(config, /https:\/\/lkijdgqanbqjudiducjt\.supabase\.co/, 'config points to the isolated DEMO project');
assert.match(config, /sb_publishable_/, 'browser config uses a publishable key');
assert.match(config, /environment:\s*"DEMO"/, 'config declares DEMO environment');
assert.match(config, /paymentsEnabled:\s*false/, 'real payments remain disabled');
assert.doesNotMatch(config, /moyhiluyhjsujhwlyeuu|service_role|eyJhbGciOi/i, 'config contains no production project reference or secret-style credential');

for (const api of [
  'demo-register-customer', 'demo-business-create', 'demo-catalog-write',
  'demo-order-create', 'demo-order-status-update', 'demo-appointment-create',
  'demo-membership-manage'
]) assert.ok(app.includes("functions.invoke('" + api + "'"), 'connected UI invokes ' + api);

for (const table of [
  'user_memberships', 'businesses', 'branches', 'catalog_items',
  'catalog_item_prices', 'orders', 'medical_appointments'
]) assert.ok(app.includes("from('" + table + "'"), 'connected UI reads ' + table);

for (const authFlow of ['signInWithPassword', 'signUp', 'signOut']) {
  assert.ok(app.includes('auth.' + authFlow), 'connected UI implements ' + authFlow);
}
assert.match(app, /paymentsEnabled\s*!==\s*false/, 'client refuses to initialize unless payment switch is false');
assert.match(app, /demo_provider_id/, 'clinic booking uses a provider scoped to the demo clinic');

assert.match(bootstrap, /demo_create_business_atomic/, 'bootstrap defines demo business creation');
assert.match(bootstrap, /demo_register_customer_atomic/, 'bootstrap defines customer provisioning');
assert.match(catalog, /demo_upsert_catalog_item_price_atomic/, 'catalog helper writes item and price atomically');
assert.match(catalog, /grant execute on function public\.demo_upsert_catalog_item_price_atomic[\s\S]*?to service_role/i, 'catalog atomic helper is service-role only');
assert.match(stock, /mantiqatix_demo_reserve_catalog_stock/, 'order creation reserves synthetic stock');
assert.match(stock, /mantiqatix_demo_restore_catalog_stock/, 'order cancellation restores synthetic stock');
assert.match(hardening, /payment|wallet|settlement/i, 'hardening covers payment paths');
assert.match(hardeningDelta, /digital_page_payment_events[\\s\\S]*?from public, anon, authenticated/i, 'payment event table grants are removed from browser roles');
assert.match(hardeningDelta, /update_medical_appointment_status_backend/, 'clinic status mutation is server-only in DEMO');
assert.match(hardeningDelta, /grant execute on function public\\.create_medical_appointment_backend[\\s\\S]*?to authenticated, service_role/i, 'clinic booking RPC remains available to authenticated users');
assert.match(hardeningDelta, /create_purchase_order_backend[\\s\\S]*?upsert_catalog_settings_backend/, 'out-of-scope backend RPCs are restricted in DEMO');

console.log('Connected DEMO contract: PASS (config isolation, auth flows, seven server functions, core reads, DB helper contracts, payment-off boundary).');
