import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');
const workflow = fs.readFileSync('.github/workflows/module-professionalization.yml', 'utf8');

const requiredAppContracts = [
  "async function loadLiveData()",
  "if(m.error)throw m.error;",
  "live.error=e?.message||'تعذر تحميل بيانات المنصة';",
  "}finally{live.loading=false;}",
  "const savedId=window.MNTYActiveMembershipId||localStorage.getItem('MNTYActiveMembershipId')",
  "live.activeMembershipId=active?.id||null;"
];
for (const marker of requiredAppContracts) {
  if (!app.includes(marker)) {
    throw new Error('Membership refresh contract missing: ' + marker);
  }
}

const loadStart = app.indexOf('async function loadLiveData()');
const loadEnd = app.indexOf('\n\nfunction roleLabel', loadStart);
if (loadStart < 0 || loadEnd < 0) {
  throw new Error('Could not isolate loadLiveData implementation');
}
const load = app.slice(loadStart, loadEnd);
if (!/try\s*\{[\s\S]*if\(m\.error\)throw m\.error;[\s\S]*catch\(e\)\{live\.error=e\?\.message\|\|'تعذر تحميل بيانات المنصة';\}finally\{live\.loading=false;\}/.test(load)) {
  throw new Error('Membership load failures must set a visible error state and always clear loading');
}

const accountStart = app.indexOf('async function accountView()');
const accountEnd = app.indexOf('\nfunction ', accountStart + 1);
if (accountStart < 0 || accountEnd < 0) {
  throw new Error('Could not isolate accountView implementation');
}
const account = app.slice(accountStart, accountEnd);
for (const marker of [
  'if(live.error){',
  'تعذر تحديث بيانات الحساب',
  'لم نتمكن من التحقق من العضويات الحالية',
  "document.getElementById('account-retry-load')?.addEventListener('click',()=>accountView());",
  "document.getElementById('account-logout-safe')?.addEventListener('click',()=>logout());",
  'return;'
]) {
  if (!account.includes(marker)) {
    throw new Error('Membership error UI contract missing: ' + marker);
  }
}

const renderStart = app.indexOf('async function renderApp(options={})');
const nextFunctionOffset = app.slice(renderStart + 1).search(/\n(?:async\\s+)?function\\s+[A-Za-z_$][\\w$]*\\s*\\(/);
const renderEnd = nextFunctionOffset < 0 ? -1 : renderStart + 1 + nextFunctionOffset;
if (renderStart < 0 || renderEnd < 0) {
  throw new Error('Could not isolate renderApp implementation');
}
const render = app.slice(renderStart, renderEnd);
if (!/await loadLiveData\(\);if\(live\.error\)\{showAppError\(live\.error\);return\}/.test(render)) {
  throw new Error('Main app render must stop and show a safe error state when membership loading fails');
}

if (!workflow.includes('node scripts/validate-membership-refresh-contract.mjs')) {
  throw new Error('Membership refresh validator is not wired into CI');
}

console.log('Membership refresh/failure-state/UI contract: PASS');
