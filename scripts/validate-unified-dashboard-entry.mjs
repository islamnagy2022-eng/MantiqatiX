import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('apps/catalog-frontend/src/App.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const navbar = read('apps/catalog-frontend/src/components/Navbar.tsx');
const portal = read('apps/catalog-frontend/src/modules/account/SubscriberAccountPortal.tsx');
const production = read('apps/catalog-frontend/src/lib/production.ts');
const contextSource = read('apps/catalog-frontend/src/context/AppContext.tsx');
const types = read('apps/catalog-frontend/src/types/index.ts');
const catalogAdmin = read('supabase/functions/catalog-admin/index.ts');
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
assert.match(portal, /const AdminDashboard = lazy\(\(\) => import\('\.\.\/\.\.\/components\/admin\/AdminDashboard'/, 'admin dashboard must load only when the admin mode is opened');
assert.match(portal, /isAdmin\s*\?\s*<Suspense fallback=\{<DashboardFallback\/>\}><AdminDashboard\/>/, 'platform admin workspace must remain a distinct lazy dashboard component');
assert.match(portal, /section==='manage_business' && isAdmin && currentBusiness/, 'platform admins may open the selected business tools under platform authority');
assert.match(portal, /صلاحية المنصة/, 'platform-admin selected business view must disclose that it does not impersonate the owner');
assert.match(portal, /hasBusinessModulePermission\(authSession/, 'displayed business permissions must use the centralized permission helper');
assert.match(types, /export interface AccountMembershipContext/, 'account switcher context must have an explicit safe type');
assert.match(types, /availableMemberships\?: AccountMembershipContext\[\]/, 'only bootstrap-returned membership contexts may be switched');
assert.match(production, /switchableMembershipRoles = new Set\(\['OWNER', 'BUSINESS_OWNER', 'ADMIN', 'EMPLOYEE', 'STAFF'\]\)/, 'only supported active business membership roles may be exposed');
assert.match(production, /businesses\.filter\(\(business\) => business\.id === String\(membership\.business_id\) && String\(business\.tenantId \|\| ''\) === tenantId\)/, 'membership mode must match both business and tenant');
assert.match(production, /activeMembershipId: platform \? undefined : \(chosenMembership\?\.id \|\| own\?\.id\)/, 'platform admin mode must remain distinct from business membership mode');
assert.match(contextSource, /switchAccountMembership: \(membershipId: string, businessId: string\) => Promise<boolean>/, 'switching must bind the membership ID to its exact business ID');
assert.match(contextSource, /action: 'CATALOG_READ',[\s\S]{0,220}membershipId: mode\.membershipId,[\s\S]{0,100}\.\.\.\(mode\.branchId \? \{ branchId: mode\.branchId \} : \{\}\)/, 'each mode switch must send the exact membership ID and branch scope');
assert.match(catalogAdmin, /const membershipId = body\.membershipId == null \|\| body\.membershipId === "" \? null : String\(body\.membershipId\)\.trim\(\)/, 'catalog-admin must accept an optional exact membership identity');
assert.match(catalogAdmin, /\(!membershipId \|\| String\(m\.id\) === membershipId\)/, 'catalog-admin must filter business scope to the selected membership when supplied');
assert.match(catalogAdmin, /const scopedPlatformMembership = !membershipId && activeMemberships\.some/, 'platform admin bypass must not override an explicitly selected business membership');

assert.match(contextSource, /...previous\.filter\(\(product\) => product\.businessId !== mode\.businessId\)/, 'the previous business catalog data must be replaced when the selected membership scope changes');
assert.match(contextSource, /authUserIdRef\.current !== userId/, 'mode switching must bind to the current authenticated identity');
assert.match(contextSource, /const authSessionRef = useRef\(authSession\)/, 'mode switching must retain a latest-session reference across async reads');
assert.match(contextSource, /useLayoutEffect\(\(\) => \{ authSessionRef\.current = authSession; \}, \[authSession\]\)/, 'latest auth session reference must synchronize before browser interaction');
assert.match(contextSource, /const latestSession = authSessionRef\.current[\s\S]{0,1600}if \(!authorizedMode\) return false/, 'membership switch must revalidate the exact membership against the latest session before committing state');
assert.match(contextSource, /authSessionRef\.current = nextSession;[\s\S]{0,80}setAuthSession\(nextSession\)/, 'session reference and React state must be committed together after validation');
assert.match(contextSource, /currentView === 'account_portal' \|\| currentView === 'merchant_admin'/, 'account portal must use the active authorized business context');
assert.match(contextSource, /requestedView === 'account_portal' && boot\.authSession\.isAuthenticated/, 'account portal deep links must restore only after authenticated bootstrap');
assert.match(contextSource, /const loadPublicCatalogForRoute = \(businessId: string\)/, 'public storefront selection must load only the selected catalogue for signed-out visitors');
assert.match(contextSource, /useEffect\(\(\) => \{\s*if \(currentView !== 'public_storefront'\) return;\s*loadPublicCatalogForRoute\(routeBusinessIdRef\.current \|\| selectedBusinessId\);/, 'direct and selected public storefront routes must trigger on-demand catalogue loading');
assert.match(contextSource, /requestedView === 'account_portal' && authSession\.isAuthenticated/, 'browser back/forward may restore the account portal only for an authenticated account');
assert.match(contextSource, /const switchToPlatformAdminMode = \(\): boolean/, 'platform admin mode must have a separate server-derived grant');
assert.match(portal, /switchAccountMembership\(mode\.membershipId,\s*mode\.businessId\)/, 'UI must switch by the exact business-membership pair');
assert.match(portal, /ACCOUNT_MEMBERSHIP_SWITCH_ENABLED = false/, 'membership switching must remain disabled until the exact-scope Edge Function is deployed');
assert.match(contextSource, /if \(!ACCOUNT_MEMBERSHIP_SWITCH_ENABLED\) return false/, 'the membership switch action must fail closed while the live backend is older');
assert.match(e2e, /account-membership-switch-disabled-until-live-exact-membership-edge/, 'browser coverage must prove no membership switch is exposed before backend rollout');
assert.match(e2e, /membershipId: body\.membershipId/, 'browser fixture must still capture exact membership identity for the future enabled path');
assert.match(e2e, /platform-admin-remains-separate-while-business-membership-switch-is-gated/, 'browser coverage must prove platform authority remains distinct while business switching is disabled');

const guestBootstrap = production.slice(production.indexOf('export async function bootstrapProductionUser'));
const guestBlock = guestBootstrap.slice(guestBootstrap.indexOf('if (!user) {'), guestBootstrap.indexOf('\n  }', guestBootstrap.indexOf('if (!user) {')) + 4);
assert.doesNotMatch(guestBlock, /fetchPublicDirectory\(/, 'signed-out auth bootstrap must not duplicate the independent public-directory load');
assert.match(guestBlock, /businesses:\s*\[\]/, 'signed-out auth bootstrap must return without duplicate directory data');

assert.match(e2e, /unified-dashboard-entry-only-through-account-portal/, 'browser E2E must cover account-only dashboard entry');
assert.match(e2e, /authenticated-account-without-membership-is-read-only/, 'browser E2E must cover authenticated Google identity without membership');

console.log('UNIFIED_DASHBOARD_ACCOUNT_ENTRY_CONTRACT=PASS');
