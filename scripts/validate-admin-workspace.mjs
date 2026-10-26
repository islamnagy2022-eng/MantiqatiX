import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');
const rbac = fs.readFileSync('web/rbac.js', 'utf8');

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
  ['Super Admin creation uses server functions', /superAdminFunction\(['"]business-register['"][\s\S]*superAdminFunction\(['"]business-approval['"][\s\S]*superAdminFunction\(['"]business-branch-admin['"][\s\S]*superAdminFunction\(['"]catalog-admin['"]/]
  ['Super Admin creation uses server functions', /superAdminFunction\(['"]business-register['"][\s\S]*superAdminFunction\(['"]business-approval['"][\s\S]*superAdminFunction\(['"]business-branch-admin['"][\s\S]*superAdminFunction\(['"]catalog-admin['"]/]
];

const failed = checks.filter(([name, rule]) => {
  const ok = rule instanceof RegExp ? rule.test(app) : rule;
  if (!ok) console.error('FAIL:', name);
  return !ok;
});

if (failed.length) process.exit(1);
console.log(`Admin workspace regression guard passed (${checks.length} checks).`);
