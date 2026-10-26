import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const app = read('apps/catalog-frontend/src/App.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const nav = read('apps/catalog-frontend/src/components/Navbar.tsx');
const production = read('apps/catalog-frontend/src/lib/production.ts');
const access = read('apps/catalog-frontend/src/lib/access.ts');
const accessTest = read('apps/catalog-frontend/src/lib/access.test.ts');

const checks = [
  ['app computes guarded screenView', () => {
    assert.match(app, /canAccessView\(authSession\.role, currentView\)/);
    assert.match(app, /screenView !== currentView/);
  }],
  ['merchant dashboard only renders for subscriber or platform admin', () => {
    assert.match(app, /screenView === 'merchant_admin' && \(authSession\.role === 'subscriber' \|\| authSession\.role === 'admin'\) && <MerchantDashboard \/>/);
  }],
  ['super admin dashboard only renders for admin role', () => {
    assert.match(app, /screenView === 'super_admin' && authSession\.role === 'admin' && <AdminDashboard \/>/);
  }],
  ['context rejects unauthorized view changes', () => {
    assert.match(context, /const setCurrentView = \(view: ViewMode\) => \{[\s\S]*?if \(!canAccessView\(authSession\.role, view\)\)[\s\S]*?defaultViewForRole/);
  }],
  ['unauthenticated and no-subscription states are distinct', () => {
    assert.match(production, /authenticated: false, accessState: 'public'/);
    assert.match(production, /authenticated: true, accessState: 'no_active_subscription'/);
  }],
  ['no active catalog membership only receives public directory data', () => {
    assert.match(production, /if \(!platform && roleMemberships\.length === 0\)[\s\S]*?fetchPublicDirectory\(\)[\s\S]*?role: 'guest', authenticated: true, accessState: 'no_active_subscription'/);
    assert.match(app, /accessState === 'no_active_subscription'[\s\S]*?لا توجد عضوية نشاط نشطة على حسابك/);
  }],
  ['successful OAuth boot closes login modal', () => {
    assert.match(context, /setAdminSettings\(\{ \.\.\.boot\.adminSettings, adminPassword: '' \}\);[\s\S]*?if \(user\) setIsLoginModalOpen\(false\)/);
  }],
  ['navigation labels no-subscription status', () => {
    assert.match(nav, /لا توجد عضوية نشطة — التصفح العام فقط/);
    assert.match(nav, /authSession\.role === 'guest' && !authSession\.authenticated/);
  }],
  ['platform-only subscriptions and billing actions fail closed', () => {
    assert.match(context, /const updateSubscriber = async \(updated: Subscriber\) => \{ if \(authSession\.role !== 'admin'\)/);
    assert.match(context, /const deleteSubscriber = async \(id: string\) => \{ if \(authSession\.role !== 'admin'\)/);
    assert.match(context, /const updateAdminSettings = \(settings: Partial<AdminSettings>\) => \{ if \(authSession\.role !== 'admin'\) return/);
    assert.match(context, /const confirmAdminPayment = \(businessId: string\) => \{ if \(authSession\.role !== 'admin'\) return/);
    assert.match(context, /const toggleBusinessFreeze = \(businessId: string\) => \{ if \(authSession\.role !== 'admin'\) return/);
  }],
  ['central access policy keeps public screens open and admin screens restricted', () => {
    assert.match(access, /if \(normalizedView === 'super_admin'\) return normalizedRole === 'admin'/);
    assert.match(access, /if \(normalizedView === 'merchant_admin'\) return normalizedRole === 'admin' \|\| normalizedRole === 'subscriber'/);
    assert.match(accessTest, /guest:[\s\S]*?merchant_admin: false,[\s\S]*?super_admin: false/);
    assert.match(accessTest, /subscriber:[\s\S]*?merchant_admin: true,[\s\S]*?super_admin: false/);
    assert.match(accessTest, /admin:[\s\S]*?merchant_admin: true,[\s\S]*?super_admin: true/);
  }],
];

const failures = [];
for (const [name, check] of checks) {
  try {
    check();
    console.log('PASS:', name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL:', name, error instanceof Error ? error.message : error);
  }
}
if (failures.length) {
  console.error(`Frontend role-screen access contract failed: ${failures.length}/${checks.length}`);
  process.exit(1);
}
console.log(`Frontend role-screen access contract: PASS (${checks.length} checks).`);
