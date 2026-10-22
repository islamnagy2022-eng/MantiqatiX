import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");
const smm = fs.readFileSync("web/smm.js", "utf8");

const required = [
  ["Google OAuth primary", "sb.auth.signInWithOAuth({provider:'google',options:", app],
  ["Secure OAuth redirect", "function oauthRedirectUrl(){return window.location.origin+window.location.pathname", app],
  ["Main Google sign-in", "sb.auth.signInWithOAuth({provider:'google',options:", app],
  ["Main email OTP removed", "signInWithOtp(", app, true],
  ["Main OTP verification removed", "verifyOtp(", app, true],
  ["Session verification", "session?.user", app],
  ["Registration request path", "submitRegistrationRequest", app],
  ["Customer direct activation", "sb.functions.invoke('mnty-customer-registration'", app],
  ["Customer direct activation tenant", "tenant_id:'MNTY-PLATFORM'", app],
  ["Additional membership roles", "['CUSTOMER','SERVICE_PROVIDER']", app],
  ["Duplicate pending protection", ".in('status',['PENDING','APPROVED'])", app],
  ["Additional membership UI", "request-service_provider", app],
  ["Membership gate", "if(!live.memberships.length){membershipRequiredView();return}", app],
  ["Logout state reset", "live.memberships=[]", app],
  ["Registration review Edge Function", "sb.functions.invoke('mnty-registration-review'", app],
  ["Admin role guard", "['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase())", app],
  ["Role switcher", 'id="mx-role-switcher"', app],
  ["Membership switch authority", "live.memberships.find(m=>m.id===membershipId&&m.status==='ACTIVE')", app],
  ["Role switch persistence", "localStorage.setItem('MNTYActiveMembershipId',membershipId)", app],
  ["Platform to public home", "id=\"go-public-home\"", app],
  ["Public home to platform", "typeof openPlatform==='function'?openPlatform():goLogin()", fs.readFileSync("web/home.js", "utf8")],
  ["No duplicate customer return control", "id=\"mx-customer-return\"", app, true],
  ["Role labels", "BUSINESS_OWNER:'مالك نشاط'", app],
  ["Role labels", "SUPPORT_MANAGER:'مدير الدعم'", app],
  ["Role labels", "SERVICE_PROVIDER:'صاحب نشاط / مقدم خدمة'", app],
  ["SMM Google sign-in", "sb.auth.signInWithOAuth({provider:'google',options:", smm],
  ["SMM email OTP removed", "signInWithOtp(", smm, true],
  ["SMM OTP verification removed", "verifyOtp(", smm, true],
  ["SMM Google button", 'id="google-auth"', smm],
  ["SMM no password auth", "signInWithPassword", smm, true],
  ["No direct membership insert", ".from('user_memberships').insert", app, true],
  ["No direct membership update", ".from('user_memberships').update", app, true],
  ["No direct membership delete", ".from('user_memberships').delete", app, true],
  ["No direct registration review update", ".from('account_registration_requests').update", app, true]
];


const failures = [];
if (/\\basync\\s+\\n\\s*function\\s+/.test(app)) failures.push("No dangling async keyword may precede a non-async function declaration");
const googleStart = app.indexOf("async function signInWithGoogle(intent='login'){");
const googleEnd = app.indexOf("function authView(msg='',emailValue='',mode=authIntent){", googleStart);
const googleSignIn = googleStart >= 0 && googleEnd > googleStart ? app.slice(googleStart, googleEnd) : "";
if (!googleSignIn.includes("authView('تعذر بدء تسجيل الدخول بحساب Google: '+(e?.message||'خطأ غير معروف'),'',intent);")) failures.push("Google OAuth errors must preserve the login or registration mode");
if (googleSignIn.includes("authView('تعذر بدء تسجيل الدخول بحساب Google: '+(e?.message||'خطأ غير معروف'),'','',intent);")) failures.push("Google OAuth error handler must not pass registration intent in an ignored fourth argument");
const authBootStart = app.indexOf("async function bootAuth(){");
const authBootEnd = app.indexOf("function bindGenericWorkspaceTabs(){", authBootStart);
const authBoot = authBootStart >= 0 && authBootEnd > authBootStart ? app.slice(authBootStart, authBootEnd) : "";
if (!authBoot.includes("if(new URLSearchParams(window.location.search).get('openAuth')==='1'){authView();return}")) failures.push("Google preview entry must open the platform auth view");
if (!authBoot.includes("authView('تعذر تهيئة جلسة الدخول. أعد المحاولة بعد تحديث الصفحة.');") || !authBoot.includes("get('openAuth')==='1'")) failures.push("Auth bootstrap errors must preserve the Google sign-in view");
if (authBoot.indexOf("if(data?.session)") < 0 || authBoot.indexOf("if(data?.session)") > authBoot.indexOf("get('openAuth')==='1'")) failures.push("Existing authenticated sessions must be handled before showing sign-in");
const membershipLoadStart = app.indexOf("async function loadLiveData(){");
const membershipLoadEnd = app.indexOf("function ", membershipLoadStart + 30);
const membershipLoad = membershipLoadStart >= 0 ? app.slice(membershipLoadStart, membershipLoadEnd > membershipLoadStart ? membershipLoadEnd : membershipLoadStart + 12000) : "";
if (!membershipLoad.includes("live.memberships.length===1?live.memberships[0]:null")) failures.push("Multiple active memberships must not silently select the first tenant");
if (!membershipLoad.includes("savedMembership||null")) failures.push("Stale saved membership IDs must fail closed rather than switching tenants");
if (!app.includes("function membershipSelectionRequiredView()") || !app.includes("if(!live.activeMembershipId){membershipSelectionRequiredView();return}")) failures.push("Missing explicit membership selection gate");
if (!app.includes("data-select-membership") || !app.includes("switchMembership(button.dataset.selectMembership)")) failures.push("Membership selection actions must use the validated membership switcher");
const membershipViewStart = app.indexOf("function membershipSelectionRequiredView(){");
const membershipViewEnd = app.indexOf("function membershipRequiredView(){", membershipViewStart);
const membershipView = membershipViewStart >= 0 && membershipViewEnd > membershipViewStart ? app.slice(membershipViewStart, membershipViewEnd) : "";
if (!membershipView.includes("live.memberships.filter(m=>m.status==='ACTIVE')")) failures.push("Workspace selector must list active memberships only");
if (!membershipView.includes("esc(m.id)")) failures.push("Workspace selector must HTML-escape membership identifiers");
const switchStart = app.indexOf("async function switchMembership(membershipId){");
const switchEnd = app.indexOf("async function openPrivilegedWorkspace", switchStart);
const switchSource = switchStart >= 0 && switchEnd > switchStart ? app.slice(switchStart, switchEnd) : "";
if (!switchSource.includes("live.memberships.find(m=>m.id===membershipId&&m.status==='ACTIVE')")) failures.push("Membership switch must validate the requested ID against the signed-in user's active memberships");
if (!switchSource.includes("if(!target)return showToast(")) failures.push("Invalid or inactive membership switch attempts must fail closed");


const bootStart = app.indexOf("async function bootAuth(){");
const bootEnd = app.indexOf("async function renderApp()", bootStart);
const bootAuth = bootStart >= 0 && bootEnd > bootStart ? app.slice(bootStart, bootEnd) : "";
if (bootAuth.includes("sb.auth.signOut()")) failures.push("Automatic boot must not sign out");
const signOutMatches = [...app.matchAll(/sb\.auth\.signOut\(\)/g)];
if (signOutMatches.length !== 1) failures.push("Explicit logout is the only sign-out path");

for (const [name, marker, source, forbidden] of required) {
  const present = source.includes(marker);
  if (forbidden ? present : !present) failures.push(name);
}

const migration = fs.readFileSync("supabase/migrations/20260927150000_owner_role_switch_memberships.sql", "utf8");
for (const role of ["ADMIN","MANAGER","BUSINESS_OWNER","SUPPORT","SUPPORT_MANAGER","EMPLOYEE","STAFF","CUSTOMER","SERVICE_PROVIDER"]) {
  if (!migration.includes(`('${role}')`)) failures.push(`Owner role context: ${role}`);
}
if (/cross join[\s\S]*SUPER_ADMIN/i.test(migration) || /values\s*\([\s\S]*['\"]SUPER_ADMIN['\"]/i.test(migration)) failures.push("Owner role contexts must not bootstrap SUPER_ADMIN");

if (failures.length) {
  console.error("Auth/registration production invariant check failed:");
  for (const name of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Auth/registration production invariants passed: ${required.length} checks + Owner role-switch invariants.`);
