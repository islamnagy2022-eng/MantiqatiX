import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");
const smm = fs.readFileSync("web/smm.js", "utf8");
const customerRegistration = fs.readFileSync("supabase/functions/mnty-customer-registration/index.ts", "utf8");
const customerActivationMigration = fs.readFileSync("supabase/migrations/20260929150000_rc213_customer_direct_activation.sql", "utf8");

const failures = [];

const required = [
  ["PKCE OAuth flow", "flowType:'pkce'", app],
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
  ["Membership recovery action", "function activateCustomerMembership()", app],
  ["Membership recovery uses protected server function", "sb.functions.invoke('mnty-customer-registration',{body:{tenant_id:'MNTY-PLATFORM'}})", app],
  ["Membership recovery verifies session identity", "verified.user.id!==user?.id", app],
  ["Membership recovery requires confirmed active customer membership", "CUSTOMER_MEMBERSHIP_NOT_CONFIRMED", app],
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


const serverRequired = [
  ["Customer activation authenticates the bearer token with Supabase Auth", "admin.auth.getUser(token)", customerRegistration],
  ["Customer activation rejects anonymous users", "actor.is_anonymous", customerRegistration],
  ["Customer activation restricts tenant to platform tenant", 'tenantId !== "MNTY-PLATFORM"', customerRegistration],
  ["Customer activation derives user ID from verified actor", "p_user_id: actor.id", customerRegistration],
  ["Customer activation uses atomic private RPC", '.schema("private")', customerRegistration],
  ["Atomic activation RPC is not executable by authenticated clients", "from public, anon, authenticated", customerActivationMigration],
  ["Atomic activation RPC is granted to service role only", "to service_role", customerActivationMigration],
  ["Atomic activation uses an advisory lock for idempotency", "pg_advisory_xact_lock", customerActivationMigration],
];
for (const [name, marker, source] of serverRequired) {
  if (!source.includes(marker)) failures.push(name);
}
if (/p_user_id\\s*:\\s*body\\./.test(customerRegistration)) failures.push("Customer activation must not accept user ID from request body");
// The service role key is server-only; the browser must never reference it.
if (app.includes("SUPABASE_SERVICE_ROLE_KEY")) failures.push("Service role key reference must not appear in browser app source");
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
