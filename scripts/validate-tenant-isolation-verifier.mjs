import assert from "node:assert/strict";
import fs from "node:fs";

const verifier = fs.readFileSync("scripts/verify-tenant-isolation.sql", "utf8");
const fixturePath = "supabase/tests/baselines/tenant_isolation_two_tenant_fixture.sql";

assert.ok(verifier.includes("E2E_FIXTURE_MISSING_TENANT_A"), "must fail closed when tenant A is absent");
assert.ok(verifier.includes("E2E_FIXTURE_MISSING_TENANT_B"), "must fail closed when tenant B is absent");
assert.ok(verifier.includes("E2E_FIXTURE_MISSING_ORDER_ROWS"), "must require orders in both tenants");
assert.ok(verifier.includes("E2E_FIXTURE_MISSING_PAYMENT_INTENT_ROWS"), "must require payment intents in both tenants");
assert.ok(verifier.includes("E2E_FIXTURE_MISSING_ONBOARDING_ROWS"), "must require onboarding rows in both tenants");
assert.ok(verifier.includes("E2E_FIXTURE_MISSING_PRIVATE_BUSINESS_ROWS"), "must require private business rows in both tenants");
assert.ok(verifier.includes("v_own_orders=0") && verifier.includes("v_own_payments=0") && verifier.includes("v_own_onboarding=0"), "must require positive own-tenant visibility");
assert.ok(verifier.includes("v_cross_orders<>0") && verifier.includes("v_cross_payments<>0") && verifier.includes("v_cross_onboarding<>0"), "must deny cross-tenant visibility in both directions");
assert.ok(verifier.includes("MNTY-TEST-A") && verifier.includes("MNTY-TEST-B"), "must use the explicit two-tenant test fixture, not a platform admin identity");
assert.ok(!verifier.includes("MNTY-PLATFORM"), "must not select a platform tenant identity for tenant-isolation assertions");
assert.ok(verifier.trimEnd().endsWith("ROLLBACK;"), "must rollback its transaction");
assert.ok(fs.existsSync(fixturePath), "the synthetic fixture file must exist alongside this verifier");

console.log("Tenant isolation verifier fail-closed contract passed.");
