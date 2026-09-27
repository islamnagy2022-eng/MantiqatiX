import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");
const smm = fs.readFileSync("web/smm.js", "utf8");

const required = [
  ["Main Email OTP", "sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}})", app],
  ["Main OTP verification", "sb.auth.verifyOtp({email,token,type:'email'})", app],
  ["Session verification", "session?.user", app],
  ["Registration request path", "submitRegistrationRequest", app],
  ["Membership gate", "if(!live.memberships.length){membershipRequiredView();return}", app],
  ["Logout state reset", "live.memberships=[]", app],
  ["Registration review Edge Function", "sb.functions.invoke('mnty-registration-review'", app],
  ["Admin role guard", "['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase())", app],
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

if (failures.length) {
  console.error("Auth/registration production invariant check failed:");
  for (const name of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Auth/registration production invariants passed: ${required.length} checks.`);
