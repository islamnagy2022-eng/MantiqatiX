import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('apps/catalog-frontend/src/App.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const navbar = read('apps/catalog-frontend/src/components/Navbar.tsx');
const portal = read('apps/catalog-frontend/src/modules/account/SubscriberAccountPortal.tsx');
const production = read('apps/catalog-frontend/src/lib/production.ts');
const e2e = read('apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs');

assert.match(context, /export type ViewMode[^;]*'account_portal'/, 'account_portal must be part of the route type');
assert.match(context, /requestedView === 'account_portal'/, 'account_portal must survive a direct URL reload');
assert.match(app, /currentView === 'account_portal' && !authSession\.isAuthenticated/, 'account portal must fail closed for signed-out users');
assert.match(app, /lazy\(\(\) => import\('\.\/modules\/account\/SubscriberAccountPortal'/, 'account portal must remain a secondary lazy-loaded screen');
assert.match(navbar, /setCurrentView\('account_portal'\)/, 'signed-in users must have an account entry point');

for (const label of ['لوحة تحكم نشاطي', 'لوحة صاحب النشاط', 'الداشبورد الاحترافية', 'لوحة الإدارة والعمولات']) {
  assert.equal(navbar.includes(label), false, 'public navigation must not expose dashboard tab: ' + label);
}

assert.match(portal, /const isAdmin = authSession\.role === 'admin'/, 'platform admin mode must be session-derived');
assert.match(portal, /!isAdmin && canAccessMerchantDashboard\(authSession\)/, 'merchant workspace must not be inferred from platform admin mode');
assert.match(portal, /!isAdmin && canAccessProfessionalDashboard\(authSession\)/, 'employee/professional workspace must use existing session permissions');
assert.match(portal, /isAdmin\s*\?\s*<AdminDashboard\s*\/>/, 'platform admin workspace must remain a distinct admin component');
assert.match(portal, /hasBusinessModulePermission\(authSession/, 'displayed business permissions must use the centralized permission helper');

const guestBootstrap = production.slice(production.indexOf('export async function bootstrapProductionUser'));
const guestBlock = guestBootstrap.slice(guestBootstrap.indexOf('if (!user) {'), guestBootstrap.indexOf('\n  }', guestBootstrap.indexOf('if (!user) {')) + 4);
assert.doesNotMatch(guestBlock, /fetchPublicDirectory\(/, 'signed-out auth bootstrap must not duplicate the independent public-directory load');
assert.match(guestBlock, /businesses:\s*\[\]/, 'signed-out auth bootstrap must return without duplicate directory data');

assert.match(e2e, /unified-dashboard-entry-only-through-account-portal/, 'browser E2E must cover account-only dashboard entry');
assert.match(e2e, /authenticated-account-without-membership-is-read-only/, 'browser E2E must cover authenticated Google identity without membership');

console.log('UNIFIED_DASHBOARD_ACCOUNT_ENTRY_CONTRACT=PASS');
