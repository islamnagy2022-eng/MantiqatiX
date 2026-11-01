import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('apps/catalog-frontend/src/App.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const navbar = read('apps/catalog-frontend/src/components/Navbar.tsx');
const portal = read('apps/catalog-frontend/src/modules/account/SubscriberAccountPortal.tsx');

assert.match(context, /'account_portal'/, 'account_portal must be a supported view');
assert.match(context, /requestedView === 'account_portal' && Boolean\(boot\.authSession\.isAuthenticated\)/, 'direct account portal routes must require an authenticated session');
assert.match(context, /currentView === 'account_portal'/, 'subscriber business context must be retained inside the portal');
assert.match(app, /currentView === 'account_portal' && !authSession\.isAuthenticated/, 'the rendered account portal must fail closed for signed-out users');
assert.match(app, /lazy\(\(\) => import\('\.\/modules\/account\/SubscriberAccountPortal'/, 'account portal must be lazy-loaded');
assert.match(navbar, /setCurrentView\('account_portal'\)/, 'authenticated users must have a dedicated account entry point');
for (const route of ["setCurrentView('merchant_admin')", "setCurrentView('professional_dashboard')", "setCurrentView('super_admin')"]) {
  assert.equal(navbar.includes(route), false, 'public navigation must not expose privileged dashboard route: ' + route);
}
assert.match(portal, /hasBusinessModulePermission\(authSession/, 'permission summaries must use the centralized permission resolver');
assert.match(portal, /لا تنشئ هذه الشاشة مدفوعات ولا تغير حالة الاشتراك/, 'subscription view must remain read-only');
assert.match(portal, /!authSession\.isAuthenticated/, 'portal component must independently fail closed');
assert.match(portal, /isAdmin \? <Suspense fallback=\{<Fallback \/>\}><AdminDashboard \/>/, 'platform admin mode must retain its separate admin dashboard');
assert.match(portal, /canMerchant \? <Suspense fallback=\{<Fallback \/>\}><MerchantDashboard \/>/, 'merchant tools must remain behind existing merchant access checks');

console.log('UNIFIED_ACCOUNT_PORTAL_CONTRACT=PASS');
