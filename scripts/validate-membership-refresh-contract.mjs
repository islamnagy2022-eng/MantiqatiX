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
if (renderStart < 0) {
  throw new Error('Could not locate renderApp implementation');
}
const render = app.slice(renderStart, renderStart + 2500);
if (!/await loadLiveData\(\);if\(live\.error\)\{showAppError\(live\.error\);return\}/.test(render)) {
  throw new Error('Main app render must stop and show a safe error state when membership loading fails');
}

if (!workflow.includes('node scripts/validate-membership-refresh-contract.mjs')) {
  throw new Error('Membership refresh validator is not wired into CI');
}


const customerMigration=fs.readFileSync('supabase/migrations/20260929150000_rc213_customer_direct_activation.sql','utf8');
const customerEdge=fs.readFileSync('supabase/functions/mnty-customer-registration/index.ts','utf8');
const customerTest=fs.readFileSync('supabase/tests/rc213_customer_registration_integration.sql','utf8');
for(const marker of [
  'pg_advisory_xact_lock',
  "upper(role) = 'CUSTOMER'",
  'CUSTOMER_REGISTRATION_ACTIVATED',
  'revoke execute on function private.activate_customer_registration_atomic(uuid, varchar)'
]){
  if(!customerMigration.includes(marker))throw new Error('Customer membership activation safety marker missing: '+marker);
}
if(!/grant execute on function private\\.activate_customer_registration_atomic\\(uuid, varchar\\)[\\s\\S]*?to service_role/.test(customerMigration)){
  throw new Error('Customer membership activation RPC must grant execution to service_role only.');
}
if(!customerEdge.includes('admin.auth.getUser(token)')||!customerEdge.includes('activate_customer_registration_atomic')||!customerEdge.includes('actor.id')){
  throw new Error('Customer registration Edge Function must validate Auth and bind activation to the actor.');
}
if(!app.includes("sb.functions.invoke('mnty-customer-registration'")||!app.includes("roleOption('CUSTOMER'")){
  throw new Error('Account UI must provide the safe customer activation path when no active membership exists.');
}
if(!customerTest.includes('repeat activation created duplicate customer membership')||!customerTest.includes('inactive tenant activation must be rejected')){
  throw new Error('Customer registration integration test is missing idempotency or inactive-tenant assertions.');
}
if(!workflow.includes('customer-registration-integration')){
  throw new Error('Customer membership activation integration test is not wired into CI.');
}

console.log('Membership refresh/failure-state/UI contract: PASS');
