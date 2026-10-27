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
assert.equal(paidGate?.live_function_version, 3, 'Expected deployed catalog admin function version must be recorded');
assert.equal(paidGate?.verify_jwt, true, 'Catalog platform admin must continue requiring JWT verification');
assert.equal(paidGate?.source_exact_match, true, 'Deployed catalog admin function must match reviewed source exactly');
assert.equal(paidGate?.unrelated_modules_deployed, false, 'No unrelated backend modules may be deployed by the catalog pilot');
assert.equal(paidGate?.active_non_showcase_owner_memberships_count_before_guard, 0, 'No unpaid non-showcase owner memberships may already be active');
assert.equal(paidGate?.no_unpaid_non_showcase_owner_memberships_found, true, 'The read-only subscription audit must be recorded');

assert.equal(catalogFunctions?.status, 'PASS', 'All scoped catalog Edge Functions must have verified live source parity');
const expectedCatalogFunctions = new Map([
  ['catalog-platform-admin', { version: 3, verifyJwt: true }],
  ['catalog-admin', { version: 14, verifyJwt: false }],
  ['public-catalog-directory', { version: 2, verifyJwt: false }],
  ['public-catalog', { version: 2, verifyJwt: false }],
]);
for (const fn of catalogFunctions.functions || []) {
  const expected = expectedCatalogFunctions.get(fn.slug);
  assert.ok(expected, 'Unexpected Edge Function in the scoped catalog release: ' + fn.slug);
  assert.equal(fn.live_version, expected.version, fn.slug + ' live version must match its reviewed version');
  assert.equal(fn.verify_jwt, expected.verifyJwt, fn.slug + ' JWT mode must remain unchanged and reviewed');
  assert.equal(fn.source_exact_match, true, fn.slug + ' deployed source must match the reviewed branch');
  expectedCatalogFunctions.delete(fn.slug);
}
assert.equal(expectedCatalogFunctions.size, 0, 'Every scoped catalog Edge Function must be accounted for');
assert.equal(catalogFunctions.unrelated_functions_deployed, false, 'No unrelated Edge Functions may be deployed by the catalog pilot');

assert.ok(vite.includes("base: '/MantiqatiX/catalog-app/'"), 'Catalog frontend must be built under its own subpath');
assert.equal(manifest.scope, '/MantiqatiX/catalog-app/', 'Catalog PWA scope must not claim the platform root');
assert.equal(manifest.start_url, '/MantiqatiX/catalog-app/', 'Catalog PWA start URL must use its subpath');
assert.ok(serviceWorker.includes('mantiqatix-catalog-shell-v2'), 'Catalog service worker must use its own cache namespace');
assert.ok(serviceWorker.includes("key.startsWith('mantiqatix-catalog-shell-')"), 'Catalog service worker must not delete unrelated platform caches');
assert.ok(platformIndex.includes("new URL('/MantiqatiX/catalog-app/', current.origin)"), 'Root shell must relay OAuth callbacks to the catalog subpath');
assert.ok(platformHome.includes('href="/MantiqatiX/catalog-app/">الكتالوج الإلكتروني</a>'), 'Desktop navigation must expose the catalog module');
assert.ok(platformHome.includes('href="/MantiqatiX/catalog-app/" data-mobile-nav>الكتالوج الإلكتروني</a>'), 'Mobile navigation must expose the catalog module');

assert.ok(types.includes("status: 'active' | 'pending' | 'suspended'"), 'Subscriber status must include pending payment');
assert.ok(app.includes("status: backendStatus === 'ACTIVE' ? 'active' : backendStatus === 'SUSPENDED' ? 'suspended' : 'pending'"), 'New subscribers must not be assumed active');
assert.ok(backend.includes('SUBSCRIPTION_PAYMENT_REQUIRED'), 'Backend must reject activation without payment confirmation');
assert.ok(backend.includes('PAID_SUBSCRIPTION_ACTIVATION_FAILED'), 'Backend must activate pending memberships only after confirmed payment');
assert.ok(!app.includes('updateBusinessPaymobConfig') && !app.includes('merchantApiKey') && !app.includes('integrationIdCard'), 'Catalog context must not expose unverified Paymob credential persistence');
assert.ok(admin.includes('لن تُحفظ مفاتيح Paymob من هذه الواجهة ولن يُفعّل التحصيل الإلكتروني'), 'Admin UI must disclose that online collection remains disabled until production verification');
assert.ok(!admin.includes('handleSavePaymobConfig') && !admin.includes('paymobMerchantApiKey') && !admin.includes('Integration ID'), 'Admin UI must not expose a fake Paymob credential-save path');
assert.ok(!admin.includes("setActiveAdminTab('backup')"), 'Unverified backup/restore UI must not be exposed');
assert.ok(!admin.includes("setActiveAdminTab('control_center')"), 'Unverified advanced control-center UI must not be exposed');

assert.ok(report.status === 'BLOCKED' || report.status === 'PASS', 'Full platform gate status must remain explicit');
assert.ok(pagesWorkflow.includes('Compose existing platform root with catalog as a separate module'), 'Pages artifact must preserve the existing root');
assert.ok(pagesWorkflow.includes('mantiqatix-composed-pages-site'), 'Pages must publish the composed root plus catalog subpath');
assert.ok(!pagesWorkflow.includes('primary-catalog-frontend-dist'), 'Catalog build must not replace the existing platform root artifact');

console.log('CATALOG_PILOT_GATE=PASS');
console.log(`FULL_PLATFORM_GATE=${report.status}; this scoped gate authorizes only the catalog frontend and paid-subscription guard, not platform-wide certification.`);
console.log('CATALOG_PILOT_BACKEND_SCOPE=catalog-platform-admin + catalog-admin + public-catalog + public-catalog-directory; no payment-intent, webhook, order, finance, SMM, or MantiGO deployments.');
