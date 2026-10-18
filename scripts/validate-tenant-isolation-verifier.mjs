import assert from "node:assert/strict";
import fs from "node:fs";

const verifier = fs.readFileSync("scripts/verify-tenant-isolation.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/baselines/tenant_isolation_two_tenant_fixture.sql", "utf8");

const requiredPreflight = [
  "E2E_FIXTURE_MISSING_TENANT_A",
  "E2E_FIXTURE_MISSING_TENANT_B",
  "E2E_FIXTURE_MISSING_ISOLATED_OWNER_A",
  "E2E_FIXTURE_MISSING_ISOLATED_OWNER_B",
  "E2E_FIXTURE_MISSING_ORDER_ROWS",
  "E2E_FIXTURE_MISSING_PAYMENT_INTENT_ROWS",
  "E2E_FIXTURE_MISSING_ONBOARDING_ROWS",
  "E2E_FIXTURE_MISSING_PRIVATE_BUSINESS_ROWS",
];
for (const marker of requiredPreflight) {
  assert.ok(verifier.includes(marker), `missing fail-closed precondition: ${marker}`);
}

const tenantChecks = [
  { block: "tenant_a", ownTenant: "MNTY-TEST-A", otherTenant: "MNTY-TEST-B", suffix: "A" },
  { block: "tenant_b", ownTenant: "MNTY-TEST-B", otherTenant: "MNTY-TEST-A", suffix: "B" },
];
for (const check of tenantChecks) {
  const start = verifier.indexOf(`DO $${check.block}$`);
  const end = verifier.indexOf(`$${check.block}$;`, start + 1);
  assert.ok(start >= 0 && end > start, `missing complete ${check.block} verification block`);
  const block = verifier.slice(start, end);
  assert.ok(block.includes(`tenant_id='${check.ownTenant}'`), `${check.block} must query its own tenant`);
  assert.ok(block.includes(`tenant_id='${check.otherTenant}'`), `${check.block} must query the other tenant`);
  for (const field of ["businesses", "orders", "payments", "onboarding"]) {
    assert.ok(block.includes(`v_own_${field}=0`), `${check.block} must fail if own ${field} are invisible`);
    assert.ok(block.includes(`v_cross_${field}<>0`), `${check.block} must fail if cross-tenant ${field} are visible`);
  }
  assert.ok(block.includes(`E2E_FIXTURE_OWN_ROWS_NOT_VISIBLE_TO_TENANT_${check.suffix}`));
  assert.ok(block.includes(`CROSS_TENANT_VISIBILITY_FROM_${check.suffix}`));
}

assert.ok(verifier.includes("MNTY-TEST-A") && verifier.includes("MNTY-TEST-B"), "must use two synthetic tenants");
assert.ok(!verifier.includes("MNTY-PLATFORM"), "must not use a platform-tenant identity");
assert.ok(verifier.trimEnd().endsWith("ROLLBACK;"), "verifier must roll back its transaction");
assert.ok(!/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i.test(verifier), "verifier must not mutate database objects or rows");

const guardEnd = fixture.indexOf("\nBEGIN;");
assert.ok(guardEnd > 0, "fixture must have a guard before its first transaction");
const guard = fixture.slice(0, guardEnd);
assert.ok(guard.includes("\\if :{?mantiqati_disposable}") && guard.includes("\\if :mantiqati_disposable") && guard.includes("\\quit 3"), "fixture must refuse execution without explicit disposable authorization");
assert.ok(fixture.includes("example.invalid") && fixture.includes('"test_fixture":true'), "fixture must use synthetic non-routable identities and mark data as test-only");

const fixtureRequirements = [
  ["tenant A", /'MNTY-TEST-A'/],
  ["tenant B", /'MNTY-TEST-B'/],
  ["business rows", /INSERT INTO public\.businesses[\s\S]*?MNTY-TEST-A[\s\S]*?MNTY-TEST-B/],
  ["order rows", /INSERT INTO public\.orders[\s\S]*?MNTY-TEST-A[\s\S]*?MNTY-TEST-B/],
  ["payment intent rows", /INSERT INTO public\.payment_intents[\s\S]*?MNTY-TEST-A[\s\S]*?MNTY-TEST-B/],
  ["onboarding rows", /INSERT INTO public\.provider_onboarding_requests[\s\S]*?MNTY-TEST-A[\s\S]*?MNTY-TEST-B/],
  ["isolated owner identities", /INSERT INTO public\.user_memberships[\s\S]*?MNTY-TEST-A[\s\S]*?MNTY-TEST-B/],
];
for (const [label, pattern] of fixtureRequirements) {
  assert.match(fixture, pattern, `fixture must seed both tenants for ${label}`);
}

console.log("Tenant isolation verifier contract passed: non-vacuous preflight, bidirectional own/cross-tenant assertions, rollback-only verifier, and explicitly guarded synthetic fixture.");
