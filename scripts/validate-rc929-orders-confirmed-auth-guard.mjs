import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const migrationPath = "supabase/migrations/20261126030000_rc929_orders_confirmed_auth_claim_guard.sql";
const migration = read(migrationPath);
const baseline = read("supabase/tests/rc929_orders_missing_claim_baseline.sql");
const integration = read("supabase/tests/rc929_orders_confirmed_auth_claim_integration.sql");
const fixture = read("supabase/tests/rc465_orders_read_scope_fixture.sql");
const rc465Workflow = read(".github/workflows/rc465-orders-read-scope.yml");
const replayWorkflow = read(".github/workflows/forward-migration-chain-replay.yml");
const orderAclOverlay = read("supabase/tests/baselines/production_live_order_resources_anon_select_acl_overlay_fixture.sql");
const productionVerifier = read("scripts/production/verify-production.mjs");
const liveContract = read("scripts/production/live-reconciliation-contract.mjs");
const gateValidator = read("scripts/validate-production-migration-chain-gate.mjs");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const crosswalk = read("docs/release/REQUIRED_87_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261126.md");

assert.match(migration, /^BEGIN;/m, "RC929 must be transactional");
assert.match(migration, /^COMMIT;/m, "RC929 must commit only after all preflight checks pass");
assert.match(migration, /RC929_ORDER_RESOURCE_RLS_MUST_REMAIN_ENABLED/);
assert.match(migration, /RC929_EXPECTED_ORDER_AND_HISTORY_POLICIES_MISSING/);
assert.match(migration, /RC929_UNEXPECTED_ANON_ORDER_READ_GRANT/);
assert.match(orderAclOverlay, /REVOKE SELECT ON TABLE public\.orders FROM PUBLIC, anon/i,
  "disposable replay must clear only anon/PUBLIC SELECT from orders");
assert.match(orderAclOverlay, /REVOKE SELECT ON TABLE public\.order_status_history FROM PUBLIC, anon/i,
  "disposable replay must clear only anon/PUBLIC SELECT from order history");
assert.match(orderAclOverlay, /GRANT SELECT ON TABLE public\.orders TO authenticated/i,
  "disposable replay must preserve authenticated order reads");
assert.match(orderAclOverlay, /GRANT SELECT ON TABLE public\.order_status_history TO authenticated/i,
  "disposable replay must preserve authenticated history reads");
assert.ok(orderAclOverlay.includes("anon_orders_select") && orderAclOverlay.includes("anon_history_select"),
  "ACL overlay must report the exact resource whose anonymous SELECT privilege remains");
assert.ok(replayWorkflow.includes("production_live_order_resources_anon_select_acl_overlay_fixture.sql"),
  "chronological replay must include the test-only order ACL overlay");
const orderAclOverlayPosition = replayWorkflow.indexOf("RESTORE_TEST_ONLY_KNOWN_LIVE_ORDER_RESOURCES_ANON_SELECT_ACL_OVERLAY");
const rc929ReplayPosition = replayWorkflow.indexOf('echo "REPLAY_MIGRATION=$filename"', orderAclOverlayPosition);
assert.ok(orderAclOverlayPosition >= 0 && rc929ReplayPosition > orderAclOverlayPosition,
  "captured order ACL overlay must execute immediately before RC929 replay");
assert.equal((migration.match(/CREATE POLICY /g) || []).length, 2,
  "RC929 must add only one restrictive identity policy per order resource");

for (const table of ["public.orders", "public.order_status_history"]) {
  const policy = migration.slice(migration.indexOf("CREATE POLICY " + (table === "public.orders"
    ? "orders_confirmed_auth_only" : "order_status_history_confirmed_auth_only")));
  assert.ok(policy.includes("AS RESTRICTIVE"), table + " identity policy must be restrictive");
  assert.ok(policy.includes("FOR ALL"), table + " identity policy must cover reads and writes");
  assert.ok(policy.includes("TO authenticated"), table + " identity policy must not widen raw-anon access");
  assert.ok(policy.includes("auth.uid() IS NOT NULL"), table + " identity policy must require a user identity");
  assert.ok(policy.includes("(auth.jwt() ->> 'is_anonymous') IS NOT DISTINCT FROM 'false'"),
    table + " identity policy must fail closed for a missing, null or true anonymous claim");
  assert.ok(policy.includes("WITH CHECK"), table + " writes must enforce the same confirmed identity predicate");
}

assert.doesNotMatch(migration, /^\s*(?:GRANT|REVOKE|ALTER TABLE|INSERT INTO|UPDATE\s+public\.|DELETE FROM|TRUNCATE)\b/im,
  "RC929 must not change grants, table definitions or business/order data");
assert.ok(fixture.includes("CREATE POLICY orders_member_select"));
assert.ok(fixture.includes("CREATE POLICY order_status_history_member_read"));
assert.ok(/coalesce\(\(auth\.jwt\(\) ->> 'is_anonymous'\), 'false'\)/i.test(fixture),
  "fixture must preserve the legacy missing-claim behavior before RC929");
assert.ok(baseline.includes("RC929_BASELINE_EXPECTED_MISSING_CLAIM_ORDER_VISIBILITY"));
assert.ok(baseline.includes("RC929_BASELINE_EXPECTED_MISSING_CLAIM_HISTORY_VISIBILITY"));
for (const marker of [
  "RC929_MISSING_IS_ANONYMOUS_CLAIM_ALLOWED_ORDER_READ",
  "RC929_MISSING_IS_ANONYMOUS_CLAIM_ALLOWED_HISTORY_READ",
  "RC929_NULL_IS_ANONYMOUS_CLAIM_ALLOWED_ORDER_READ",
  "RC929_NULL_IS_ANONYMOUS_CLAIM_ALLOWED_HISTORY_READ",
  "RC929_ANONYMOUS_AUTH_ORDER_READ_ALLOWED",
  "RC929_ANONYMOUS_AUTH_HISTORY_READ_ALLOWED",
  "RC929_NULL_AUTH_UID_ALLOWED_ORDER_READ",
  "RC929_CONFIRMED_MANAGER_ORDER_COMPATIBILITY_FAILED",
  "RC929_CONFIRMED_MANAGER_HISTORY_COMPATIBILITY_FAILED",
  "RC929_CONFIRMED_CUSTOMER_ORDER_COMPATIBILITY_FAILED",
  "RC929_CONFIRMED_CUSTOMER_HISTORY_COMPATIBILITY_FAILED",
  "RC929_UNEXPECTED_CLIENT_ORDER_WRITE_GRANT",
  "RC929_ORDERS_RESTRICTIVE_CONFIRMED_AUTH_POLICY_MISSING",
  "RC929_HISTORY_RESTRICTIVE_CONFIRMED_AUTH_POLICY_MISSING"
]) assert.ok(integration.includes(marker), "RC929 integration is missing: " + marker);

for (const workflow of [rc465Workflow, replayWorkflow]) {
  assert.ok(workflow.includes("20261126030000_rc929_orders_confirmed_auth_claim_guard.sql"),
    "workflow must watch the exact RC929 migration");
  assert.ok(workflow.includes("rc929_orders_confirmed_auth_claim_integration.sql"),
    "workflow must watch the RC929 behavioral integration");
  assert.ok(workflow.includes("validate-rc929-orders-confirmed-auth-guard.mjs"),
    "workflow must invoke/watch the RC929 static validator");
}
assert.ok(rc465Workflow.includes("rc929_orders_missing_claim_baseline.sql"),
  "dedicated PostgreSQL 17 workflow must prove the old behavior before RC929");
assert.ok(rc465Workflow.includes("node scripts/validate-rc929-orders-confirmed-auth-guard.mjs"),
  "dedicated workflow must execute the RC929 static contract");
assert.ok(replayWorkflow.includes("node scripts/validate-rc929-orders-confirmed-auth-guard.mjs"),
  "full forward replay must run the RC929 static contract");

assert.ok(productionVerifier.includes("20261126030000_rc929_orders_confirmed_auth_claim_guard.sql"));
assert.ok(liveContract.includes('"20261126030000"'));
assert.ok(gateValidator.includes("20261126030000_rc929_orders_confirmed_auth_claim_guard.sql"));
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 92);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261126030000"));
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261126030000"),
  "RC929 must remain explicitly unapplied to Production");
assert.ok(crosswalk.includes("20261126030000_rc929_orders_confirmed_auth_claim_guard.sql"));
assert.ok(crosswalk.includes("BLOCKED / NOT CERTIFIED"));

console.log("RC929_ORDERS_EXPLICIT_CONFIRMED_AUTH_STATIC=PASS");
