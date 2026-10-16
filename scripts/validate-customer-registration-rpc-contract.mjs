import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("supabase/functions/mnty-customer-registration/index.ts", "utf8");
const atomic = fs.readFileSync("supabase/migrations/20260929150000_rc213_customer_direct_activation.sql", "utf8");
const invariant = fs.readFileSync("supabase/migrations/20260930100000_rc215_customer_membership_invariant.sql", "utf8");

// Preserve the reviewed repository contract until the production RPC drift is
// reconciled through an explicit design decision and isolated integration tests.
assert.match(edge, /await admin\.auth\.getUser\(token\)/, "customer registration must verify the bearer token");
assert.match(edge, /actor\.is_anonymous/, "anonymous sessions must remain rejected");
assert.match(edge, /tenantId !== "MNTY-PLATFORM"/, "customer activation must stay scoped to MNTY-PLATFORM");
assert.match(edge, /origin && origin !== allowedOrigin/, "foreign browser origins must remain rejected");
assert.match(edge, /rpc\("activate_customer_registration_atomic"/, "tracked Edge Function must keep its currently reviewed RPC");
assert.doesNotMatch(edge, /rpc\("ensure_customer_membership_for_user"/, "do not silently switch the tracked RPC without resolving behavioral differences");

// The two migrations encode materially different behavior. These checks make
// the incompatibility visible in CI instead of treating the names as aliases.
assert.match(atomic, /pg_advisory_xact_lock\(hashtextextended\(p_user_id::text, 0\)\)/, "atomic activation uses its per-user lock");
assert.match(atomic, /account_registration_requests[\s\S]*?status = 'CANCELLED'/, "atomic activation cancels pending customer registration requests");
assert.match(atomic, /'CUSTOMER_REGISTRATION_ACTIVATED'/, "atomic activation writes its audit event");
assert.doesNotMatch(atomic, /exception when others then\s*-- Membership creation is the invariant[\s\S]*?null;/, "atomic activation must not suppress audit-write failures");

assert.match(invariant, /p_user_id::text \|\| ':CUSTOMER:' \|\| p_tenant_id/, "base membership invariant uses a user/customer/tenant lock");
assert.match(invariant, /business_id,branch_id,role,permissions,status/, "base membership invariant explicitly initializes business/branch scope");
assert.match(invariant, /exception when others then[\s\S]*?null;/, "base membership invariant currently suppresses audit-write failures");
assert.match(invariant, /on_mnty_auth_user_created_customer_membership/, "the migration also wires the auth-user trigger");

console.log("Customer registration RPC source contract: PASS (RPC drift remains explicit; no production behavior changed).");
