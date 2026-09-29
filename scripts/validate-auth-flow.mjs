import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");
const smm = fs.readFileSync("web/smm.js", "utf8");

const required = [
  ["Google OAuth primary", "sb.auth.signInWithOAuth({provider:'google',options:", app],
  ["Secure OAuth redirect", "function oauthRedirectUrl(){return window.location.origin+window.location.pathname", app],
  ["Main OTP verification", "sb.auth.verifyOtp({email,token,type:'email'})", app],
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
  ["SMM Email OTP", "sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}})", smm],
  ["SMM OTP verification", "sb.auth.verifyOtp({email,token:otp,type:'email'})", smm],
  ["SMM no password auth", "signInWithPassword", smm, true],
  ["No direct membership insert", ".from('user_memberships').insert", app, true],
  ["No direct membership update", ".from('user_memberships').update", app, true],
  ["No direct membership delete", ".from('user_memberships').delete", app, true],
  ["No direct registration review update", ".from('account_registration_requests').update", app, true]
];

const failures = [];
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
