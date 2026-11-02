import fs from 'node:fs';
import assert from 'node:assert/strict';

const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');
const production = fs.readFileSync('apps/catalog-frontend/src/lib/production.ts', 'utf8');
const catalogIndex = fs.readFileSync('apps/catalog-frontend/index.html', 'utf8');
const authTypes = fs.readFileSync('apps/catalog-frontend/src/types/index.ts', 'utf8');
const app = fs.readFileSync('apps/catalog-frontend/src/App.tsx', 'utf8');
const navbar = fs.readFileSync('apps/catalog-frontend/src/components/Navbar.tsx', 'utf8');
const modal = fs.readFileSync('apps/catalog-frontend/src/components/auth/LoginModal.tsx', 'utf8');

for (const event of ["'INITIAL_SESSION'", "'SIGNED_IN'", "'SIGNED_OUT'", "'USER_UPDATED'"]) {
  assert.ok(context.includes(`event === ${event}`), `Google auth hydration must handle ${event}`);
}
assert.ok(!context.includes("event === 'TOKEN_REFRESHED'"), 'A routine Google access-token refresh must not trigger a full membership/catalog bootstrap.');
assert.ok(catalogIndex.includes('aria-busy="true"') && catalogIndex.includes('جارٍ تحميل الدليل'), 'The catalog entry must show an immediate accessible loading shell before React mounts.');
assert.ok(production.includes('let publicDirectoryInFlight: Promise<PublicDirectoryResult> | null = null;') && production.includes('if (publicDirectoryInFlight) return publicDirectoryInFlight;'), 'The AppContext and signed-out bootstrap must share one in-flight public directory request.');
assert.ok(production.includes('const platformSettingsPromise = platform') && production.includes('await platformSettingsPromise;'), 'Platform settings must load concurrently with catalog hydration rather than serially after it.');
assert.ok(context.includes("const sessionKey = incomingUserId || 'signed-out'"), 'Auth bootstrap deduplication must use stable user identity, not rotating access tokens.');
assert.ok(context.includes("setAuthBootstrapError("), 'Bootstrap failures must be visible, not silently presented as anonymous.');
assert.ok(context.includes("isAuthenticated: Boolean(session?.user)"), 'A valid Supabase session must remain distinguishable from an anonymous visitor after bootstrap failure.');
assert.ok(context.includes("lastAuthLoadKeyRef"), 'INITIAL_SESSION and getSession hydration must avoid duplicate full bootstrap work.');
assert.ok(context.includes("setBusinesses([])") && context.includes("setSubscribers([])"), 'Changing Google identities must clear prior identity data before rehydration.');
assert.ok(authTypes.includes("isAuthenticated?: boolean;") && authTypes.includes("email?: string;"), 'AuthSession must carry identity state separately from role grants.');
assert.ok(context.includes("provider: 'google'"), 'Interactive login must use Google OAuth.');
assert.ok(context.includes("new URL('/MantiqatiX/', window.location.origin).toString()"), 'Google OAuth must use the allowlisted platform root before the callback relay.');
assert.ok(fs.readFileSync('web/index.html', 'utf8').includes("new URL('/MantiqatiX/catalog-app/', current.origin)"), 'The platform root must relay OAuth callback parameters into the catalog subpath before loading its app.');
assert.ok(context.includes("queryParams: { prompt: 'select_account' }"), 'Google login must allow choosing the intended Google identity explicitly.');

assert.ok(production.includes('async function mapWithConcurrency<T, R>'), 'Authorized catalog hydration must use a bounded concurrent worker pool.');
assert.ok(production.includes('uniqueRows.slice(0, 250), 8'), 'Catalog reads must use bounded concurrency while preserving the existing row cap.');
assert.ok(production.includes('Promise.all(tenantIds.map(async (tenantId)'), 'Platform tenant business lists must load concurrently.');
assert.ok(production.includes('Promise.all(tenantWideOwnerIds.map(async (tenantId)'), 'Tenant-wide owner business lists must load concurrently.');
assert.ok(production.includes("callPlatformAdmin({ action: 'LIST_SUBSCRIBERS' })") && production.includes("callPlatformAdmin({ action: 'GET_SETTINGS' })"), 'Platform subscriber and settings reads must remain available.');
const bootstrapSection = production.slice(production.indexOf('export async function bootstrapProductionUser'), production.indexOf('export const productionRuntime'));
assert.ok(production.includes('export async function fetchPlatformSubscribers()'), 'The platform subscriber directory must have a dedicated loader.');
assert.ok(!bootstrapSection.includes("action: 'LIST_SUBSCRIBERS'"), 'Loading the complete subscriber directory must not block Google session bootstrap.');
assert.ok(context.includes('void fetchPlatformSubscribers().then((result)'), 'The subscriber directory must load asynchronously after the authenticated workspace is ready.');
assert.ok(context.includes('setSubscribersLoading(boot.authSession.role === \'admin\')'), 'The admin subscriber directory must expose a separate loading state.');
assert.ok((context.match(/if \(!result\.error\) setSubscribers\(result\.subscribers\);/g) || []).length >= 2, 'Failed background or manual subscriber refreshes must preserve the last successfully loaded directory instead of replacing it with an empty error result.');
assert.ok(context.includes('sequence !== authLoadSequence.current || authUserIdRef.current !== userId'), 'A stale manual subscriber response must not write into a later identity or auth sequence.');
assert.ok(context.includes('if (!isCurrent()) return;') && context.includes('void fetchPlatformSubscribers().then((result)'), 'A stale background subscriber response must be discarded after logout or identity switching.');
const logoutStart = context.indexOf('const logout = () => {');
const logoutEnd = context.indexOf('const addCategory', logoutStart);
const logoutBlock = context.slice(logoutStart, logoutEnd);
assert.ok(logoutBlock.indexOf('authLoadSequence.current += 1') >= 0 && logoutBlock.indexOf('authUserIdRef.current = null') >= 0 && logoutBlock.indexOf('supabase.auth.signOut()') > logoutBlock.indexOf('authUserIdRef.current = null'), 'Logout must invalidate in-flight requests and clear identity before requesting Supabase sign-out.');
assert.ok(context.includes("authSession.role !== 'admin'") && context.includes("authUserIdRef.current !== userId"), 'Manual subscriber refresh must remain restricted to the current platform-admin identity.');


assert.ok(production.includes("isAuthenticated: false"), 'Anonymous sessions must be explicitly unauthenticated.');
assert.ok(production.includes("isAuthenticated: true") && production.includes("userId: user.id"), 'Valid Google sessions must retain identity even without memberships.');
assert.ok(production.includes("const role = platform ? 'admin' : roleMemberships.length ? 'subscriber' : 'guest'"), 'Business permissions must continue to derive from active production memberships.');
assert.ok(app.includes("authSession.role !== 'admin'") && app.includes("!canAccessMerchantDashboard(authSession)") && app.includes("!canAccessProfessionalDashboard(authSession)"), 'Dashboard rendering must remain gated by the centralized membership permission checks.');
assert.ok(navbar.includes("authSession.isAuthenticated && authSession.role === 'guest'"), 'Signed-in Google accounts without active memberships must see a clear non-subscribed state.');
assert.ok(navbar.includes("authSession.role === 'guest' && !authBootstrapError && !authLoading"), 'The guest membership warning must stay hidden until session bootstrap has completed successfully.');
assert.ok(navbar.includes("!authSession.isAuthenticated && !authLoading"), 'Only anonymous visitors may see the login action; loading must not flash a guest CTA.');
assert.ok(navbar.includes('authBootstrapError'), 'Bootstrap errors must be visible globally in the navigation shell.');
assert.ok(modal.includes("handleGoogle('login')") && modal.includes("handleGoogle('signup')"), 'Login and registration buttons must both use the shared Google OAuth flow.');

console.log('Catalog Google OAuth hydration, identity-vs-membership, and role-gated UI contract: PASS');

assert.match(context, /const defaultView: ViewMode = 'marketplace_home'/, 'Every freshly authenticated account must land on the canonical marketplace home by default');
assert.ok(
  context.includes("requestedView === 'medical_directory'") &&
  context.includes("requestedView === 'marketplace_home'") &&
  context.includes("requestedView === 'contact_us'") &&
  context.includes("requestedView === 'site_map'"),
  'Role bootstrap must preserve the public Medical Directory, Marketplace, Contact and Site Map routes.'
);
assert.ok(
  context.includes("requestedView === 'super_admin' && boot.authSession.role === 'admin'") &&
  context.includes("requestedView === 'merchant_admin' && canAccessMerchantDashboard(boot.authSession)") &&
  context.includes("requestedView === 'professional_dashboard' && canAccessProfessionalDashboard(boot.authSession)") &&
  context.includes("                : 'directory';") &&
  context.includes("const isDirectoryDeepLink = params.has('activity') || params.has('listing') || params.has('group')") &&
  context.includes("!requestedView && !isDirectoryDeepLink"),
  'Role bootstrap must preserve only explicitly authorized dashboard routes and directory deep links, otherwise falling back to the public directory.'
);
assert.ok(context.includes("setCurrentView('directory');"), 'Email login and registration may open the dedicated directory search.');
assert.ok(context.includes("if (view !== 'marketplace_home' && view !== 'login') url.searchParams.set('view', view);"), 'The canonical marketplace home must keep the root URL while other public routes remain addressable.');
assert.ok(context.includes("url.searchParams.delete('activity')") && context.includes("url.searchParams.delete('listing')") && context.includes("url.searchParams.delete('group')"), 'Returning home must clear stale directory deep-link parameters.');
assert.ok(app.includes("visibleView === 'marketplace_home' && <MarketplaceHome />"), 'The marketplace component must remain mounted as a public route.');
assert.ok(navbar.includes("setCurrentView('marketplace_home')") && navbar.includes("setCurrentView('directory')"), 'Homepage and directory search must be separate navigation destinations.');
assert.ok(
  context.includes("requestedView === 'medical_directory'") &&
  context.includes("requestedView === 'marketplace_home'") &&
  context.includes("requestedView === 'contact_us'") &&
  context.includes("requestedView === 'site_map'") &&
  context.includes("window.addEventListener('popstate', restoreRouteFromLocation)"),
  'Browser history must restore the Medical Directory and all public V4 information and marketplace routes.'
);
assert.ok(
  context.includes("requestedView === 'professional_dashboard' && canAccessProfessionalDashboard(authSession)") &&
  context.includes("requestedView === 'merchant_admin' && canAccessMerchantDashboard(authSession)") &&
  context.includes("requestedView === 'super_admin' && authSession.role === 'admin'"),
  'Browser history must reapply active role and membership authorization before restoring private dashboard routes.'
);


// The subscriber account portal is a separate authenticated route; account access never grants business management rights.
const accountPortalContext = context;
assert.ok(accountPortalContext.includes("requestedView === 'account_portal' && Boolean(boot.authSession.isAuthenticated)"), 'the account portal direct route must require an authenticated session.');
assert.ok(app.includes("currentView === 'account_portal' && !authSession.isAuthenticated"), 'account portal rendering must fail closed for signed-out users.');
assert.ok(navbar.includes("setCurrentView('account_portal')"), 'authenticated users must have an account portal entry point.');
assert.ok(navbar.includes("setCurrentView('merchant_admin')") && navbar.includes("setCurrentView('professional_dashboard')") && navbar.includes("setCurrentView('super_admin')"), 'existing dashboard navigation must remain intact.');
