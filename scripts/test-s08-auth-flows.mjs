import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const smm = fs.readFileSync("web/smm.js", "utf8");
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: "PASS" }); }
  catch (error) { checks.push({ name, status: "FAIL", detail: error.message }); }
}
function has(source, marker, label) {
  assert.ok(source.includes(marker), `Missing contract: ${label}`);
}
function lacks(source, marker, label) {
  assert.ok(!source.includes(marker), `Forbidden contract present: ${label}`);
}

check("Main auth uses Google OAuth", () =>
  has(app, "sb.auth.signInWithOAuth({provider:'google',options:", "Google OAuth"));
check("SMM auth uses Google OAuth", () =>
  has(smm, "sb.auth.signInWithOAuth({provider:'google',options:", "SMM Google OAuth"));
check("Email OTP flow is not exposed in main web auth", () => {
  lacks(app, "signInWithOtp(", "signInWithOtp");
  lacks(app, "verifyOtp(", "verifyOtp");
});
check("Email OTP flow is not exposed in SMM auth", () => {
  lacks(smm, "signInWithOtp(", "signInWithOtp");
  lacks(smm, "verifyOtp(", "verifyOtp");
});
check("Main session persistence, refresh and callback detection are enabled", () => {
  has(app, "autoRefreshToken:true", "auto refresh");
  has(app, "persistSession:true", "persist session");
  has(app, "detectSessionInUrl:true", "OAuth callback detection");
});
check("SMM uses PKCE and callback detection", () => {
  has(smm, "detectSessionInUrl:true", "callback detection");
  has(smm, "flowType:'pkce'", "PKCE flow");
});
check("Main OAuth redirect is derived from same-origin page location", () => {
  has(app, "function oauthRedirectUrl(){return window.location.origin+window.location.pathname", "same-origin redirect helper");
  const match = app.match(/function oauthRedirectUrl\(\)\{[^}]+\}/);
  assert.ok(match, "redirect helper body is extractable");
  const context = { window: { location: {
    origin: "https://example.test",
    pathname: "/app/",
    search: "?campaign=qa#fragment"
  }}};
  vm.runInNewContext(match[0], context);
  assert.equal(context.oauthRedirectUrl(), "https://example.test/app/?campaign=qa");
});
check("Membership reads are user-scoped and active-only", () => {
  has(app, ".from('user_memberships').select('id,tenant_id,organization_id,business_id,branch_id,role,permissions,status').eq('user_id',uid).eq('status','ACTIVE')", "active own memberships");
});
check("Client cannot directly mutate membership rows", () => {
  lacks(app, ".from('user_memberships').insert", "direct membership insert");
  lacks(app, ".from('user_memberships').update", "direct membership update");
  lacks(app, ".from('user_memberships').delete", "direct membership delete");
});
check("Registration/review is routed through server functions", () => {
  has(app, "sb.functions.invoke('mnty-customer-registration'", "customer registration server path");
  has(app, "sb.functions.invoke('mnty-registration-review'", "registration review server path");
  lacks(app, ".from('account_registration_requests').update", "direct registration review update");
});
check("Duplicate pending/approved registration protection exists", () =>
  has(app, ".in('status',['PENDING','APPROVED'])", "duplicate registration protection"));
check("Auth boot does not silently sign out a user", () => {
  const start = app.indexOf("async function bootAuth(){");
  const end = app.indexOf("async function renderApp(", start);
  assert.ok(start >= 0 && end > start, "bootAuth boundary is present");
  lacks(app.slice(start, end), "sb.auth.signOut()", "automatic sign out during boot");
});
check("Only one explicit sign-out call exists in the main web auth source", () =>
  assert.equal([...app.matchAll(/sb\.auth\.signOut\(\)/g)].length, 1));

const failures = checks.filter(x => x.status === "FAIL");
for (const result of checks) {
  console.log(`[${result.status}] ${result.name}${result.detail ? `: ${result.detail}` : ""}`);
}
console.log(`S08 static contract checks: ${checks.length - failures.length}/${checks.length} passed.`);
if (failures.length) process.exit(1);
