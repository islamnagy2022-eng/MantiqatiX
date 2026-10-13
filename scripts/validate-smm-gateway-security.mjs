import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const edge = read("supabase/functions/smm-gateway/index.ts");
const gate = read("supabase/functions/smm-gateway/launch-gate.ts");
const requestValidation = read("supabase/functions/smm-gateway/request-validation.ts");
const transport = read("supabase/functions/smm-gateway/provider-transport.ts");
const orderValidation = read("supabase/functions/smm-gateway/order-validation.ts");
const tests = read("supabase/functions/smm-gateway/smm-gateway.test.ts");
const migration = read("supabase/migrations/20261011010000_rc456_smm_service_role_access_boundary.sql");
const aclTest = read("supabase/tests/rc456_smm_service_role_integration.sql");

const at = (source, fragment, label) => {
  const i = source.indexOf(fragment);
  assert.ok(i >= 0, label + " must exist");
  return i;
};

// The production handler's launch kill switch must reject before identity lookup,
// request parsing, DB access, provider transport, wallet RPCs, or order mutations.
const serve = at(edge, "Deno.serve(async(req)=>", "HTTP handler");
const deferred = at(edge, 'if(SMM_INITIAL_LAUNCH_DEFERRED||!launch.enabled)return json({error:"SMM_DEFERRED"', "fail-closed launch gate");
const identity = at(edge, "const user=await getUser(req)", "verified user lookup");
const parse = at(edge, "await readBoundedJson(req,32*1024)", "bounded body parser");
assert.ok(serve < deferred && deferred < identity && identity < parse, "launch gate must precede auth lookup and body parsing");
assert.match(edge, /const SMM_INITIAL_LAUNCH_DEFERRED=true/, "initial launch remains hard-disabled in source");
assert.match(gate, /enabledFlag === "true" && postLaunchApprovalFlag === "true"/, "two independent exact approval flags required");
assert.match(gate, /status: 503, error: "SMM_DEFERRED"/, "default gate response must be 503 fail-closed");
assert.match(tests, /SMM launch gate is closed unless both independent flags are true/, "unit coverage for launch-gate permutations exists");

// Method, auth, payload and cross-user isolation.
assert.ok(at(edge, 'if(req.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405)', "method guard") < deferred, "method guard precedes route execution");
assert.match(edge, /if\(!user\)return json\(\{error:"UNAUTHORIZED"\},401\)/, "missing/invalid/anonymous identity must be rejected");
assert.match(edge, /user\.is_anonymous\?null:user/, "anonymous users must be rejected");
assert.match(requestValidation, /REQUEST_TOO_LARGE/,"request size limit exists");
assert.match(requestValidation, /INVALID_JSON/,"malformed JSON rejected");
assert.match(requestValidation, /UNSUPPORTED_MEDIA_TYPE/,"unsupported media type rejected");
assert.match(tests, /bounded request JSON rejects unsupported, malformed, scalar and oversized bodies/, "negative request validation tests exist");
assert.match(edge, /\.eq\("user_id",user\.id\)/, "user data queries must be scoped to verified user");
assert.match(edge, /\.eq\("id",b\.order_id\)\.eq\("user_id",user\.id\)/, "order status must be owner-scoped");
assert.match(edge, /IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST/, "reused idempotency key with changed payload must conflict");
assert.match(edge, /\.eq\("idempotency_key",validatedOrder\.idempotencyKey\)/, "idempotency replay lookup exists");

// Admin boundary and least privilege.
assert.match(edge, /async function isAdmin/, "server-side admin authorization exists");
const adminGuard = edge.slice(at(edge, "async function isAdmin", "admin guard"), at(edge, "async function secret", "secret helper"));
assert.match(adminGuard, /smm_admins/, "explicit SMM admin allowlist supported");
assert.match(adminGuard, /role==="SUPER_ADMIN"/, "membership fallback restricted to SUPER_ADMIN");
assert.match(adminGuard, /MNTY-PLATFORM/, "membership must be platform tenant scoped");
assert.match(adminGuard, /p\.full_control===true/, "explicit full-control boolean required");
assert.doesNotMatch(adminGuard, /role==="OWNER"|role==="ADMIN"/, "tenant owner/admin must not become global SMM admin");
assert.match(edge, /if\(!(await isAdmin\(user\.id\)\)\)return json\(\{error:"FORBIDDEN"\},403\)/, "admin mutations must check authorization");

// Secret containment, safe logs, outbound transport and ambiguous failures.
assert.doesNotMatch(edge, /api_key_ciphertext/, "gateway source must not directly read ciphertext column");
assert.doesNotMatch(edge, /console\.(?:log|error|warn)\([^\n]*(?:apiKey|api_key|secret\(|KEY)/i, "logs must not include credentials or secret material");
assert.match(edge, /smm_get_provider_secret/, "credentials must be fetched through the trusted RPC");
assert.match(edge, /Cache-Control":"no-store"/, "responses must not be cached");
assert.match(transport, /endpoint\.protocol !== "https:"/, "provider endpoint must require HTTPS");
assert.match(transport, /allowed\.has\(host\)/, "provider host allowlist required");
assert.match(transport, /redirect:"error"/, "provider requests must reject redirects");
assert.match(edge, /setTimeout\(\(\)=>controller\.abort\(\),15000\)/, "provider call timeout required");
assert.match(edge, /PROVIDER_RESULT_UNKNOWN/, "ambiguous provider outcome must be surfaced for reconciliation");
assert.doesNotMatch(edge, /refund|smm_refund_wallet/i, "gateway must not auto-refund an ambiguous provider outcome");
assert.match(orderValidation, /idempotency_key|idempotencyKey/i, "order validation must include idempotency contract");

// The ACL regression must keep credentials and wallet ledger outside direct table access.
assert.match(migration, /revoke all on table public\.smm_provider_credentials, public\.smm_wallet_transactions[\s\S]*service_role/i, "credentials and wallet transactions remain RPC-only");
assert.match(aclTest, /provider credentials must remain RPC-only/, "isolated PostgreSQL ACL test covers credentials");
console.log("SMM gateway security contract: PASS (static contract only; not a live HTTP/runtime test)");
