#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = path => fs.readFileSync(new URL(path, `file://${root}/`), 'utf8');
const report = JSON.parse(read('docs/release/production-migration-reconciliation.json'));
const qadam = report.qadam_catalog_followup_check;
const paidGate = report.catalog_platform_admin_paid_subscription_gate;
const catalogFunctions = report.catalog_pilot_edge_function_parity_check;
const app = read('apps/catalog-frontend/src/context/AppContext.tsx');
const admin = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
const types = read('apps/catalog-frontend/src/types/index.ts');
const backend = read('supabase/functions/catalog-platform-admin/index.ts');
const vite = read('apps/catalog-frontend/vite.config.ts');
const manifest = JSON.parse(read('apps/catalog-frontend/public/manifest.webmanifest'));
const serviceWorker = read('apps/catalog-frontend/public/sw.js');
const platformHome = read('web/home.js');
const platformIndex = read('web/index.html');
const pagesWorkflow = read('.github/workflows/pages.yml');

assert.ok(qadam && qadam.status === 'DATA_READY_LEDGER_DRIFT', 'Qadam catalog must be explicitly data-ready with ledger drift disclosed');
assert.equal(qadam.owner_membership_active, true, 'Qadam owner membership must be active');
assert.equal(qadam.business_active, true, 'Qadam business must remain active');
assert.equal(qadam.catalog_public_enabled, true, 'Qadam public catalog must be enabled');
assert.equal(qadam.provider_profile_status, 'ACTIVE', 'Qadam provider profile status must be active');
assert.equal(qadam.contact_fields_complete, true, 'Qadam contact fields must be complete');
assert.equal(qadam.stock_tracking_enabled_item_count, 0, 'Pilot must not fabricate stock tracking data');
assert.equal(qadam.active_provider_profile, true, 'Qadam public provider profile must be active');
assert.equal(qadam.provider_profile_owner_matches_business_owner, true, 'Provider profile must belong to the intended owner');
assert.equal(qadam.repair_migration_version_recorded, true, 'Scoped owner/profile repair migration must be recorded');
assert.equal(qadam.active_product_count, 15, 'Expected active Qadam catalog item count must be verified');
assert.equal(qadam.matching_price_rows, 12, 'Expected priced item count must be verified');
assert.equal(qadam.contact_for_price_product_count, 3, 'Contact-for-price items must remain intentionally unpriced');
assert.equal(qadam.migration_version_recorded, false, 'Original seed ledger drift must remain disclosed rather than falsely marked applied');

assert.equal(paidGate?.status, 'PASS', 'Paid subscription activation guard must be deployed and verified');
assert.equal(paidGate?.function_slug, 'catalog-platform-admin');
assert.equal(paidGate?.live_function_version, 23, 'Current live catalog platform-admin version must be recorded');
assert.equal(paidGate?.verify_jwt, true, 'Catalog platform admin must continue requiring JWT verification');
assert.equal(paidGate?.source_exact_match, false, 'The scoped activity-module settings/audit drift must remain disclosed rather than hidden');
assert.equal(paidGate?.paid_subscription_guard_source_evidence?.subscription_payment_required_marker, true, 'Live platform admin must reject unpaid business restoration');
assert.equal(paidGate?.paid_subscription_guard_source_evidence?.paid_subscription_activation_failed_marker, true, 'Live platform admin must activate pending owners only after an admin-confirmed paid state');
assert.equal(paidGate?.paid_subscription_guard_source_evidence?.only_admin_confirmed_paid_state_activates_pending_owner_memberships, true, 'Pending owner memberships must be activated only by the paid/admin-confirmed path');
assert.equal(paidGate?.activity_module_admin_writes_enabled, false, 'Activity-module override writes must remain disabled until atomic settings+audit support is deployed');
assert.ok(String(paidGate?.activity_module_admin_write_deferred_reason || '').includes('atomic'), 'The live platform-admin source difference must be explicitly scoped to the deferred atomic audit contract');
assert.equal(paidGate?.unrelated_modules_deployed, false, 'No unrelated backend modules may be deployed by the catalog pilot');
assert.equal(paidGate?.active_non_showcase_owner_memberships_count_before_guard, 0, 'No unpaid non-showcase owner memberships may already be active');
assert.equal(paidGate?.no_unpaid_non_showcase_owner_memberships_found, true, 'The read-only subscription audit must be recorded');

assert.equal(catalogFunctions?.status, 'PARTIAL_WITH_PUBLIC_READ_PARITY', 'Public catalog functions must be source-aligned; platform-admin activity-module writes remain an explicit disabled exception');
assert.equal(catalogFunctions?.activity_module_admin_writes_enabled, false, 'Activity-module settings writes must remain disabled');
assert.equal(catalogFunctions?.activity_module_admin_deferred_until_atomic_audit, true, 'Activity-module settings writes must remain blocked until atomic audit is available');
assert.equal(catalogFunctions?.unrelated_functions_deployed, false, 'No unrelated Edge Functions may be deployed by the catalog pilot');
const expectedCatalogFunctions = new Map([
  ['catalog-platform-admin', { version: 23, verifyJwt: true, exact: false }],
  ['catalog-admin', { version: 20, verifyJwt: false, exact: true }],
  ['public-catalog-directory', { version: 17, verifyJwt: false, exact: true }],
  ['public-catalog', { version: 7, verifyJwt: false, exact: true }],
]);
for (const fn of catalogFunctions.functions || []) {
  const expected = expectedCatalogFunctions.get(fn.slug);
  assert.ok(expected, 'Unexpected Edge Function in the scoped catalog release: ' + fn.slug);
  assert.equal(fn.live_version, expected.version, fn.slug + ' live version must match the freshly inspected Supabase deployment');
  assert.equal(fn.verify_jwt, expected.verifyJwt, fn.slug + ' JWT mode must remain unchanged and reviewed');
  assert.equal(fn.source_exact_match, expected.exact, fn.slug + ' source parity must match the documented deployment exception');
  if (fn.slug === 'catalog-platform-admin') {
    assert.equal(fn.status, 'DRIFT_FOUND', 'The non-parity admin function must remain explicitly disclosed');
    assert.equal(fn.deferred_write_scope, 'activity-module-overrides-and-audit');
    assert.equal(fn.write_disabled_in_frontend, true);
  } else {
    assert.equal(fn.status, 'PASS_SOURCE_PARITY', fn.slug + ' must be source-aligned with main');
  }
  expectedCatalogFunctions.delete(fn.slug);
}
assert.equal(expectedCatalogFunctions.size, 0, 'Every scoped catalog Edge Function must be accounted for');

assert.ok(vite.includes("base: process.env.VITE_BASE_PATH || '/MantiqatiX/'"), 'Catalog frontend must support the retained legacy subpath without claiming the platform root');
assert.equal(manifest.scope, '/MantiqatiX/', 'Catalog PWA scope must not claim the platform root');
assert.equal(manifest.start_url, '/MantiqatiX/', 'Catalog PWA start URL must use its subpath');
assert.ok(serviceWorker.includes('mantiqatix-primary-catalog-shell-v3'), 'Catalog service worker must use its own cache namespace');
assert.ok(serviceWorker.includes("key.startsWith('mantiqatix-primary-catalog-shell-')"), 'Catalog service worker must not delete unrelated platform caches');
assert.ok(platformIndex.includes("new URL('/MantiqatiX/catalog-app/', current.origin)"), 'Preserved legacy source must retain its compatibility redirect; it is not published as the root UI');
assert.ok(platformHome.includes('href="/MantiqatiX/catalog-app/">الكتالوج الإلكتروني</a>'), 'Legacy source navigation may retain the catalog link for future development');
assert.ok(platformHome.includes('href="/MantiqatiX/catalog-app/" data-mobile-nav>الكتالوج الإلكتروني</a>'), 'Legacy source mobile navigation may retain the catalog link for future development');

assert.ok(types.includes("status: 'active' | 'pending' | 'suspended'"), 'Subscriber status must include pending payment');
assert.ok(app.includes("status: backendStatus === 'ACTIVE' ? 'active' : backendStatus === 'SUSPENDED' ? 'suspended' : 'pending'"), 'New subscribers must not be assumed active');
assert.ok(backend.includes('SUBSCRIPTION_PAYMENT_REQUIRED'), 'Backend must reject activation without payment confirmation');
assert.ok(backend.includes('PAID_SUBSCRIPTION_ACTIVATION_FAILED'), 'Backend must activate pending memberships only after confirmed payment');
assert.ok(!app.includes('updateBusinessPaymobConfig') && !app.includes('merchantApiKey') && !app.includes('integrationIdCard'), 'Catalog context must not expose unverified Paymob credential persistence');
assert.ok(admin.includes('لن تُحفظ مفاتيح Paymob من هذه الواجهة ولن يُفعّل التحصيل الإلكتروني'), 'Admin UI must disclose that online collection remains disabled until production verification');
const activityModuleAdmin = read('apps/catalog-frontend/src/components/admin/ActivityModulesAdmin.tsx');
const activityModuleE2E = read('apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs');
assert.ok(activityModuleAdmin.includes('ACTIVITY_MODULE_ADMIN_WRITE_ENABLED = false'), 'Unverified activity-module settings writes must stay disabled');
assert.ok(activityModuleE2E.includes('activity-module-admin-writes-disabled-until-atomic-audit-backend'), 'Browser E2E must prove activity-module admin writes remain disabled');
assert.ok(activityModuleE2E.includes("request.action === 'SAVE_SETTINGS'"), 'Browser E2E must assert no settings save request is sent before atomic audit support is deployed');
assert.ok(!admin.includes('handleSavePaymobConfig') && !admin.includes('paymobMerchantApiKey') && !admin.includes('Integration ID'), 'Admin UI must not expose a fake Paymob credential-save path');
assert.ok(!admin.includes("setActiveAdminTab('backup')"), 'Unverified backup/restore UI must not be exposed');
assert.ok(!admin.includes("setActiveAdminTab('control_center')"), 'Unverified advanced control-center UI must not be exposed');

assert.ok(report.status === 'BLOCKED' || report.status === 'PASS', 'Full platform gate status must remain explicit');
assert.ok(pagesWorkflow.includes('Publish the electronic catalog as the only production site'), 'Pages artifact must preserve the existing root');
assert.ok(pagesWorkflow.includes('mantiqatix-composed-pages-site'), 'Pages must publish the composed root plus catalog subpath');
assert.ok(!pagesWorkflow.includes('cp -a web/'), 'Legacy UI must not be copied into the production artifact');

console.log('CATALOG_PILOT_GATE=PASS');
console.log(`FULL_PLATFORM_GATE=${report.status}; this scoped gate authorizes only the catalog frontend and paid-subscription guard, not platform-wide certification.`);
console.log('CATALOG_PILOT_BACKEND_SCOPE=catalog-platform-admin + catalog-admin + public-catalog + public-catalog-directory; no payment-intent, webhook, order, finance, SMM, or MantiGO deployments.');
