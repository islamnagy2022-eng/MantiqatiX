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
const clinicGuard = read('supabase/demo/20261026-clinic-appointment-sector-guard.sql');
const clinicTimeGuard = read('supabase/demo/20261026-clinic-appointment-future-time-guard.sql');
const clinicTimeGuardTest = read('supabase/demo/tests/20261026-clinic-appointment-future-time-guard.sql');
const secretGuard = read('supabase/demo/20261026-restrict-push-secret-rpc.sql');
const grantAlignment = read('supabase/demo/20261026-align-security-definer-grants.sql');
const scopeFreeze = read('supabase/demo/20261026-freeze-out-of-scope-rpcs.sql');
const orderCreate = read('supabase/demo/functions/demo-order-create/index.ts');
const orderStatus = read('supabase/demo/functions/demo-order-status-update/index.ts');
const catalogWrite = read('supabase/demo/functions/demo-catalog-write/index.ts');

assert.match(html, /connected-config\.js/, 'connected page loads the DEMO-only config');
assert.match(html, /connected\.js/, 'connected page loads the database-backed client');
assert.match(html, /@supabase\/supabase-js@/, 'connected page loads Supabase SDK');
assert.doesNotMatch(html, /src=["'](?:\.\.\/)?config\.js(?:\?|["'])/, 'connected page never loads production config');

assert.match(config, /https:\/\/lkijdgqanbqjudiducjt\.supabase\.co/, 'config points to the isolated DEMO project');
assert.match(config, /sb_publishable_/, 'browser config uses a publishable key');
assert.match(config, /environment:\s*"DEMO"/, 'config declares DEMO environment');
assert.match(config, /paymentsEnabled:\s*false/, 'real payments remain disabled');
assert.match(config, /primaryOwnerEmail:\s*"islam\.nagy2022@gmail\.com"/, 'the configured primary owner account uses the requested Google identity');
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

for (const authFlow of ['signInWithOAuth', 'signOut']) {
  assert.ok(app.includes('auth.' + authFlow), 'connected UI implements ' + authFlow);
}
assert.match(app, /paymentsEnabled\s*!==\s*false/, 'client refuses to initialize unless payment switch is false');
assert.match(app, /signInWithOAuth\(\{[\s\S]*?provider:\s*'google'/, 'connected DEMO uses the same Google OAuth flow as production');
assert.match(app, /redirectTo:\s*oauthRedirectUrl\(\)/, 'Google OAuth returns to the current DEMO route');
assert.match(app, /login_hint:\s*String\(cfg\.primaryOwnerEmail/, 'Google OAuth is hinted toward the configured primary owner account');
assert.doesNotMatch(app, /signInWithPassword|auth\.signUp\(/, 'connected DEMO does not create a separate email/password login path');
assert.match(app, /function cleanAuthUrl\(\)/, 'OAuth callback parameters are cleaned after session restore');
assert.match(app, /demo_provider_id/, 'clinic booking uses a provider scoped to the demo clinic');
assert.ok(orderCreate.includes('DEMO_BUSINESS_SCOPE_REQUIRED') && orderCreate.includes('DEMO_BRANCH_SCOPE_REQUIRED'), 'order creation rejects non-DEMO business and branch');
assert.ok(orderCreate.includes('DEMO_PROVIDER_SCOPE_REQUIRED') && orderCreate.includes('DEMO_CATALOG_ITEM_SCOPE_REQUIRED'), 'order creation requires DEMO provider and synthetic catalogue items');
assert.ok(orderCreate.includes('metadata?.synthetic_only === true'), 'order creation accepts only explicitly synthetic DEMO items');
assert.ok(orderStatus.includes('DEMO_ORDER_SCOPE_REQUIRED') && orderStatus.includes('payments_enabled !== false'), 'order-status updates require a synthetic unpaid DEMO order');
assert.ok(orderStatus.includes('DEMO_BRANCH_SCOPE_REQUIRED'), 'order-status updates require a DEMO-tagged branch');
assert.ok(catalogWrite.includes('branchScope.settings?.environment !== "DEMO"'), 'catalog writes require a DEMO-tagged branch');
assert.ok(app.includes('clientIdempotencyKey,'), 'order submission passes the retained idempotency key');

assert.match(app, /saved === 'OWNER' && \(activeMemberships\(\)\.length \|\| hasPlatformOwnerAccess\(\)\)/, 'a customer cannot restore an owner workspace without an owner/platform membership');
assert.match(app, /next === 'OWNER' && !activeMemberships\(\)\.length && !hasPlatformOwnerAccess\(\)/, 'server-backed owner membership is required before switching into owner workspace');
assert.match(app, /if \(activeMemberships\(\)\.length \|\| hasPlatformOwnerAccess\(\)\) modes\.push\(\['OWNER'/, 'the owner workspace switch is hidden from ordinary customers');
assert.match(app, /modes\.length < 2\) return ''/, 'ordinary customers do not see a workspace switcher');
assert.match(app, /mode === 'CUSTOMER' && !hasPlatformOwnerAccess\(\) && activeMemberships\(\)\.length === 0/, 'ordinary customer is restricted to the homepage/catalog view');
assert.match(app, /class="customer-home-only"/, 'customer-only homepage has a dedicated isolated layout');
assert.match(app, /renderCatalog\(\)/, 'the customer homepage exposes the public catalog');
assert.match(app, /if \(data\.tab === 'orders'\) return renderOrders\(null, null, ownOrders, false\)/, 'customer order-status actions remain disabled in any privileged customer workspace');

assert.ok(app.includes('MANTIQATIX_DEMO_ORDER_RETRY_V1'), 'order retry record is scoped to the DEMO user/business/branch/item');
assert.ok(app.includes('JSON.stringify({ clientIdempotencyKey, quantity })'), 'pending retry persists the exact quantity with its idempotency key');
assert.ok(app.includes('pendingRetry.quantity !== quantity'), 'an ambiguous order response blocks changed quantity until same-key retry');
assert.ok(app.includes('const definitiveHttpFailure'), 'a definite non-retryable client response releases the pending retry record');
assert.ok(app.includes('window.sessionStorage.setItem(retryScope, JSON.stringify({ clientIdempotencyKey, quantity }))'), 'order retry record survives page-level network retries');
assert.ok(app.includes('window.sessionStorage.removeItem(retryScope)'), 'successful or definitive failed requests clear the pending retry record');
assert.ok(app.includes('delete button.dataset.idempotencyQuantity'), 'resolved orders clear the quantity stored on the button');

assert.match(bootstrap, /demo_create_business_atomic/, 'bootstrap defines demo business creation');
assert.ok(bootstrap.includes("'OWNER',") && bootstrap.includes('{"scope":"BUSINESS","demo":true}'), 'creator receives an OWNER membership scoped to the business they create');
assert.match(bootstrap, /demo_register_customer_atomic/, 'bootstrap defines customer provisioning');
assert.match(catalog, /demo_upsert_catalog_item_price_atomic/, 'catalog helper writes item and price atomically');
assert.match(catalog, /grant execute on function public\.demo_upsert_catalog_item_price_atomic[\s\S]*?to service_role/i, 'catalog atomic helper is service-role only');
assert.match(stock, /mantiqatix_demo_reserve_catalog_stock/, 'order creation reserves synthetic stock');
assert.match(stock, /mantiqatix_demo_restore_catalog_stock/, 'order cancellation restores synthetic stock');
assert.match(hardening, /payment|wallet|settlement/i, 'hardening covers payment paths');
assert.match(hardeningDelta, /digital_page_payment_events[\s\S]*?from public, anon, authenticated/i, 'payment event table grants are removed from browser roles');
assert.match(hardeningDelta, /update_medical_appointment_status_backend/, 'clinic status mutation is server-only in DEMO');
assert.match(hardeningDelta, /grant execute on function public\.create_medical_appointment_backend[\s\S]*?to authenticated, service_role/i, 'clinic booking RPC remains available to authenticated users');
assert.match(hardeningDelta, /create_purchase_order_backend[\s\S]*?upsert_catalog_settings_backend/, 'out-of-scope backend RPCs are restricted in DEMO');
assert.match(clinicGuard, /b\.settings->>'environment',[\s\S]*?b\.settings->>'sector_code',[\s\S]*?mp\.settings->>'environment',[\s\S]*?mp\.settings->>'sector_code'/, 'appointment RPC is restricted to DEMO doctor/clinic business and provider');
assert.match(clinicGuard, /SET search_path TO ''/, 'clinic appointment definer uses an empty search_path');
assert.ok(clinicTimeGuard.includes('pg_catalog.clock_timestamp()') && clinicTimeGuard.includes('APPOINTMENT_TIME_MUST_BE_FUTURE'), 'clinic booking RPC rejects past/current appointment timestamps at the database boundary');
assert.match(clinicTimeGuard, /SET search_path TO ''/, 'future-time guard preserves an empty search_path for the definer');
assert.ok(clinicTimeGuardTest.includes('APPOINTMENT_TIME_MUST_BE_FUTURE') && clinicTimeGuardTest.includes('ACTIVE_MEDICAL_PROVIDER_NOT_FOUND') && clinicTimeGuardTest.includes('TEST_ASSERTION_FAILED'), 'repeatable DEMO SQL test covers past-time rejection and future-time provider validation without writes');
assert.match(secretGuard, /revoke all on function public\.get_mnty_push_secrets\(\) from public, anon, authenticated/i, 'Vault secret RPC is not browser-executable');
assert.match(secretGuard, /grant execute on function public\.get_mnty_push_secrets\(\) to service_role/i, 'Vault secret RPC remains backend-only');
assert.ok((grantAlignment.match(/REVOKE ALL ON FUNCTION public\./g) || []).length >= 70, 'grant alignment explicitly enumerates shared and out-of-scope RPCs');
assert.match(grantAlignment, /REVOKE ALL ON FUNCTION public\.mnty_can\(text, character varying, uuid, character varying\) FROM PUBLIC, anon, authenticated[\s\S]*?GRANT EXECUTE ON FUNCTION public\.mnty_can\(text, character varying, uuid, character varying\) TO authenticated/i, 'RLS authorization helper keeps the production authenticated grant');
assert.match(grantAlignment, /REVOKE ALL ON FUNCTION public\.matrimony_create_request_backend\(uuid, text\) FROM PUBLIC, anon, authenticated[\s\S]*?GRANT EXECUTE ON FUNCTION public\.matrimony_create_request_backend\(uuid, text\) TO service_role/i, 'out-of-scope matrimony RPCs remain backend-only in DEMO');
assert.ok((scopeFreeze.match(/REVOKE ALL ON FUNCTION public\./g) || []).length >= 25, 'the frozen scope has explicit backend-only grants for unrelated modules');
assert.match(scopeFreeze, /REVOKE ALL ON FUNCTION public\.create_mantigo_ride_backend\(uuid, text, text, text, text, text, text, numeric, text\) FROM PUBLIC, anon, authenticated[\s\S]*?GRANT EXECUTE ON FUNCTION public\.create_mantigo_ride_backend\(uuid, text, text, text, text, text, text, numeric, text\) TO service_role/i, 'out-of-scope ride mutation RPC is server-only in DEMO');

console.log('Connected DEMO contract: PASS (config isolation, auth flows, seven server functions, core reads, DB helper contracts, payment-off boundary).');
