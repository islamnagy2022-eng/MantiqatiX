import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const app = read('apps/catalog-frontend/src/App.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const navbar = read('apps/catalog-frontend/src/components/Navbar.tsx');
const portal = read('apps/catalog-frontend/src/modules/account/SubscriberAccountPortal.tsx');
const browserE2E = read('apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs');

assert.match(context, /'account_portal'/, 'account_portal must be a supported route');
assert.match(context, /requestedView === 'account_portal' && Boolean\(boot\.authSession\.isAuthenticated\)/, 'direct account portal routes must require an authenticated session');
assert.match(context, /currentView === 'account_portal'/, 'subscriber business context must stay bound to the authorized business in the portal');
assert.match(app, /currentView === 'account_portal' && !authSession\.isAuthenticated/, 'the rendered account portal must fail closed for signed-out users');
assert.match(app, /lazy\(\(\) => import\('\.\/modules\/account\/SubscriberAccountPortal'/, 'account portal must be lazy-loaded');
assert.match(app, /visibleView === 'account_portal'/, 'the protected route must render its dedicated account view');
assert.match(navbar, /setCurrentView\('account_portal'\)/, 'authenticated users must have a dedicated account entry point');

// The account route is additive: all established dashboard routes and role checks remain.
for (const route of ["setCurrentView('merchant_admin')", "setCurrentView('professional_dashboard')", "setCurrentView('super_admin')"]) {
  assert.ok(navbar.includes(route), 'account portal must not remove existing dashboard navigation: ' + route);
}
assert.match(navbar, /canAccessMerchantDashboard\(authSession\)/);
assert.match(navbar, /canAccessProfessionalDashboard\(authSession\)/);
assert.match(portal, /hasBusinessModulePermission\(authSession/);
assert.match(portal, /!authSession\.isAuthenticated/, 'portal component must independently fail closed');
assert.match(portal, /عرض فقط: لا تنشئ هذه الشاشة مدفوعات ولا تغير حالة الاشتراك/, 'subscription display must remain read-only');
assert.match(portal, /const business = isAdmin \? undefined : currentBusiness/, 'the portal must not display an admin-selected business as a subscription');
assert.match(portal, /Cross-membership switching is intentionally unavailable/i, 'the portal must not infer or enable membership switching');
assert.doesNotMatch(portal, /localStorage|sessionStorage|addSaleRecord|walletBalance|callPlatformAdmin|callCatalogAdmin/, 'portal must not introduce local-only or financial mutation paths');
assert.match(portal, /const permissions = isAdmin \? \[\] : PERMISSION_ITEMS/, 'platform permissions must not be represented as business permissions');
assert.match(browserE2E, /additive-account-portal-preserves-dashboard-links-readonly-subscription-and-refresh/);
assert.match(browserE2E, /account-portal-direct-route-fails-closed-for-guest/);

console.log('ADDITIVE_ACCOUNT_PORTAL_CONTRACT=PASS');
