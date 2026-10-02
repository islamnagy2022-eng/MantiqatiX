import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');

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
  ['Super Admin control is role and permission gated', /function\s+canSuperAdmin\(\)[\s\S]*MNTY_RBAC[\s\S]*can\(/],
  ['Super Admin creation uses server functions', /superAdminFunction\(['"]business-register['"][\s\S]*superAdminFunction\(['"]business-approval['"][\s\S]*superAdminFunction\(['"]business-branch-admin['"][\s\S]*superAdminFunction\(['"]catalog-admin['"]/]
];

const failed = checks.filter(([name, rule]) => {
  const ok = rule instanceof RegExp ? rule.test(app) : rule;
  if (!ok) console.error('FAIL:', name);
  return !ok;
});

if (failed.length) process.exit(1);
console.log(`Admin workspace regression guard passed (${checks.length} checks).`);
