import fs from 'node:fs';

const app = fs.readFileSync('web/app.js', 'utf8');
const css = fs.readFileSync('web/styles.css', 'utf8');

function requireMatch(label, pattern, source = app) {
  if (!pattern.test(source)) {
    console.error('FAIL:', label);
    process.exitCode = 1;
  }
}

const accountStart = app.indexOf('function accountView');
const nextFunction = /\n(?:async\s+)?function\s+/.exec(app.slice(accountStart + 20));
const accountEnd = nextFunction ? accountStart + 20 + nextFunction.index : -1;
if (accountStart < 0 || accountEnd < 0) {
  console.error('FAIL: accountView function boundaries found');
  process.exit(1);
}
const account = app.slice(accountStart, accountEnd);

requireMatch('account center refreshes live membership data', /function accountView\(\)[\s\S]*?await loadLiveData\(\)/, account);
requireMatch('membership refresh failure fails closed', /if\(live\.error\)[\s\S]*?تعذر تحديث بيانات الحساب/, account);
requireMatch('compact workspace list is rendered', /class="mx-workspace-list"/, account);
requireMatch('workspace action does not expose internal tenant identifier', /mx-workspace-item__main[\s\S]*?data-membership-open/, account);
if (/النطاق:\s*['"]\s*\+esc\(m\.tenant_id\)/.test(account)) {
  console.error('FAIL: internal tenant identifier is rendered in account UI');
  process.exitCode = 1;
}
const dashboardIdCount = (app.match(/id="account-dashboard"/g) || []).length;
if (dashboardIdCount !== 1) {
  console.error('FAIL: dashboard action must have exactly one unique DOM id');
  process.exitCode = 1;
}
requireMatch('dashboard entry is conditional on active privileged membership', /const canAccessDashboard=memberships\.some\(m=>m\.status==='ACTIVE'&&\['SUPER_ADMIN','OWNER','ADMIN','MANAGER'\]/, account);
requireMatch('dashboard button is rendered only for allowed membership', /canAccessDashboard\?'<section class="card mx-account-dashboard-entry"/, account);
const dashboardHandlerStart = account.indexOf("getElementById('account-dashboard')?.addEventListener('click',async()=>{");
const dashboardHandlerEnd = account.indexOf("\n});", dashboardHandlerStart);
if (dashboardHandlerStart < 0 || dashboardHandlerEnd < 0) {
  console.error('FAIL: dashboard click handler boundaries found');
  process.exitCode = 1;
} else {
  const dashboardHandler = account.slice(dashboardHandlerStart, dashboardHandlerEnd);
  const refreshIndex = dashboardHandler.indexOf('await loadLiveData()');
  const errorGuardIndex = dashboardHandler.indexOf('if(live.error)');
  const authorizationIndex = dashboardHandler.indexOf("const allowed=(live.memberships||[]).some");
  const routeIndex = dashboardHandler.indexOf('await openPrivilegedWorkspace()');
  if (!(refreshIndex >= 0 && errorGuardIndex > refreshIndex && authorizationIndex > errorGuardIndex && routeIndex > authorizationIndex)) {
    console.error('FAIL: dashboard click must refresh, fail closed, authorize, then route');
    process.exitCode = 1;
  }
  requireMatch('dashboard action is disabled during authorization refresh', /button\.disabled=true[\s\S]*?جارٍ التحقق من الصلاحية/, dashboardHandler);
  requireMatch('dashboard action is restored after success or failure', /finally\{[\s\S]*?currentButton\.disabled=false/, dashboardHandler);
}
requireMatch('dashboard click denies access when privileged membership is absent', /if\(!allowed\)\{showToast\('لا تملك صلاحية الوصول إلى لوحة التحكم\.'/ , account);
requireMatch('dashboard uses existing privileged workspace router', /await openPrivilegedWorkspace\(\)/, account);
requireMatch('existing membership switch flow is retained', /data-membership-open[\s\S]*?await switchMembership\(id\)/, account);
requireMatch('mobile dashboard entry styles exist', /@media\s*\(max-width:\s*620px\)[\s\S]*?\.mx-account-dashboard-entry__button\{width:100%!important\}/, css);

if (process.exitCode) process.exit(1);
console.log('Account UI/navigation regression guard passed (15 checks).');
