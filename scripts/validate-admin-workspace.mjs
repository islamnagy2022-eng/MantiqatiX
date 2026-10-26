import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');
const rbac = fs.readFileSync('web/rbac.js', 'utf8');
const catalogContext = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');

const checks = [
  ['selectModule is an async function', /async\s+function\s+selectModule\s*\(name\)/],
  ['no duplicate async selectModule declaration', !/async\s+async\s+function\s+selectModule/.test(app)],
  ['renderApp loads live data before workspace restore decision', /async\s+function\s+renderApp\(options=\{\}\)[\s\S]*?await\s+loadLiveData\(\);[\s\S]*?savedWorkspace/],
  ['admin workspace is restored only for privileged active memberships', /savedWorkspace===['"]ADMIN['"][\s\S]*?privileged/],
  ['privileged workspace persists admin mode', /localStorage\.setItem\(['"]MNTYWorkspaceMode['"],['"]ADMIN['"]\)/],
  ['privileged workspace persists current module', /localStorage\.setItem\(['"]MNTYWorkspaceCurrent['"],['"]الرئيسية['"]\)/],
  ['contextual home keeps privileged admin users in workspace', /function\s+openContextualHome\(\)[\s\S]*?privileged[\s\S]*?adminWorkspace[\s\S]*?selectModule\(['"]الرئيسية['"]\)/],
  ['top home button uses contextual home handler', /go-public-home[^\n]*addEventListener\(['"]click['"],openContextualHome\)/],
  ['Super Admin control module exists', /التحكم الكامل/],
  ['platform control requires the explicit SUPER_ADMIN platform grant', /function\s+isPlatformOwnerSession\(\)[\s\S]*?role\|\|''\)\.toUpperCase\(\)==='SUPER_ADMIN'[\s\S]*?p\.scope==='PLATFORM'[\s\S]*?p\.full_control===true/],
  ['Super Admin control uses the strict platform predicate', /function\s+canSuperAdmin\(\)\{return isPlatformOwnerSession\(\)\}/],
  ['sidebar visibility uses the same RBAC screen guard as navigation', /modules\.filter\(m=>canViewWorkspaceModule\(m\[1\]\)\)/],
  ['direct screen navigation is guarded by the same visibility contract', /async\s+function\s+selectModule\(name\)[\s\S]*?if\(!canViewWorkspaceModule\(name\)\)/],
  ['business-scoped OWNER receives business-owner UI scope', /function\s+screenPermissionRole\(\)\{[^}]*role==='OWNER'&&Boolean\(live\.businessId\)\?'BUSINESS_OWNER':role/],
  ['platform-owner membership is preferred only when no saved membership exists', /const\s+savedMembership=live\.memberships\.find\(m=>m\.id===savedId\)[\s\S]*?const\s+platformOwnerMembership=live\.memberships\.find\(m=>[^;]*SUPER_ADMIN[^;]*scope==='PLATFORM'[^;]*full_control===true\)[\s\S]*?const\s+active=savedMembership\|\|platformOwnerMembership\|\|live\.memberships\[0\]/],
  ['stale saved screens fall back to an allowed home screen', /restoreAdminWorkspace&&!canViewWorkspaceModule\(current\)[\s\S]*?current='الرئيسية'/],
  ['unlinked BUSINESS_OWNER sees setup state instead of business operations', /BUSINESS_OWNER'&&!live\.businessId\?businessOwnerSetupView\(\)/],
  ['no-active-membership state blocks operational workspace', /if\(!live\.memberships\.length\)\{membershipRequiredView\(\);return\}/],
  ['registration review is platform-owner only in screen visibility', /if\(name==='طلبات التسجيل'\)return isPlatformOwnerSession\(\)/],
  ['catalog frontend keeps public browsing separate from operational screens', /const canOpenViewForRole = \(view: ViewMode, role: AuthSession\['role'\]\): boolean => \{[\s\S]*?if \(view === 'directory' \|\| view === 'public_storefront'\) return true;[\s\S]*?if \(view === 'merchant_admin'\) return role === 'subscriber' \|\| role === 'admin';[\s\S]*?if \(view === 'super_admin'\) return role === 'admin';[\s\S]*?return false;/],
  ['catalog frontend setter fails closed on unauthorized screens', /const setCurrentView = \(view: ViewMode\) => \{[\s\S]*?if \(canOpenViewForRole\(view, authSession\.role\)\)[\s\S]*?setCurrentViewState\('directory'\);/],
  ['bootstrap assigns initial screens according to verified role', /if \(boot\.authSession\.role === 'admin'\) setCurrentViewState\('super_admin'\);[\s\S]*?else if \(boot\.authSession\.role === 'subscriber'\) setCurrentViewState\('merchant_admin'\);[\s\S]*?else setCurrentViewState\('directory'\);/],
  ['customer support route never opens global governance workspace', /case 'الدعم والحوكمة': return isCustomerMode\(\)\?customerSupportWorkspace\(\):\(window\.MNTY_RBAC\?\.can\(screenPermissionRole\(\),'GOVERNANCE','view',live\.permissions\)===true\?governanceWorkspace\(\):scopedSupportWorkspace\(\)\);/],
  ['compound support screen requires SUPPORT or GOVERNANCE permission', /if\(name==='الدعم والحوكمة'\)return rbac\.can\(permissionRole,'GOVERNANCE','view',live\.permissions\)===true\|\|rbac\.can\(permissionRole,'SUPPORT','view',live\.permissions\)===true/],
  ['non-governance roles receive scoped support instead of platform governance', /case 'الدعم والحوكمة': return isCustomerMode\(\)\?customerSupportWorkspace\(\):\(window\.MNTY_RBAC\?\.can\(screenPermissionRole\(\),'GOVERNANCE','view',live\.permissions\)===true\?governanceWorkspace\(\):scopedSupportWorkspace\(\)\)/],
  ['scoped support workspace does not render the global governance workspace', /function scopedSupportWorkspace\(\)[\s\S]*?workspaceHead\('SUPPORT','الدعم'[\s\S]*?نطاق الحالي[\s\S]*?recordsTable\('تذاكر الدعم المتاحة'/],
  ['role dashboard quick actions share the common screen visibility gate', /function roleWorkspaceDashboard\(\)[\s\S]*?const allowed=\(name\)=>canViewWorkspaceModule\(name\)/],
  ['business owner role defaults exist in RBAC', /BUSINESS_OWNER:\{scope:'BUSINESS'/],
  ['Super Admin creation uses server functions', /superAdminFunction\(['"]business-register['"][\s\S]*superAdminFunction\(['"]business-approval['"][\s\S]*superAdminFunction\(['"]business-branch-admin['"][\s\S]*superAdminFunction\(['"]catalog-admin['"]/]
];

const failed = checks.filter(([name, rule]) => {
  const source = name.startsWith('catalog frontend') || name.startsWith('bootstrap assigns') ? catalogContext : name.startsWith('business owner role defaults') ? rbac : app;
  const ok = rule instanceof RegExp ? rule.test(source) : rule;
  if (!ok) console.error('FAIL:', name);
  return !ok;
});

if (failed.length) process.exit(1);
console.log(`Admin workspace regression guard passed (${checks.length} checks).`);
