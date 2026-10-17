import assert from "node:assert/strict";
import fs from "node:fs";

const verifier = fs.readFileSync("scripts/verify-tenant-isolation.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/baselines/tenant_isolation_two_tenant_fixture.sql", "utf8");

for (const marker of [
  "E2E_FIXTURE_MISSING_TENANT_A",
  "E2E_FIXTURE_MISSING_TENANT_B",
  "E2E_FIXTURE_MISSING_ORDER_ROWS",
  "E2E_FIXTURE_MISSING_PAYMENT_INTENT_ROWS",
  "E2E_FIXTURE_MISSING_ONBOARDING_ROWS",
  "E2E_FIXTURE_MISSING_PRIVATE_BUSINESS_ROWS",
]) assert.ok(verifier.includes(marker), `missing fail-closed precondition: ${marker}`);

assert.ok(verifier.includes("v_own_businesses=0") && verifier.includes("v_own_orders=0") && verifier.includes("v_own_payments=0") && verifier.includes("v_own_onboarding=0"), "must require own-tenant visibility for businesses, orders, payments, and onboarding");
assert.ok(verifier.includes("v_cross_businesses<>0") && verifier.includes("v_cross_orders<>0") && verifier.includes("v_cross_payments<>0") && verifier.includes("v_cross_onboarding<>0"), "must deny cross-tenant visibility for businesses, orders, payments, and onboarding in both directions");
assert.ok(verifier.includes("MNTY-TEST-A") && verifier.includes("MNTY-TEST-B"), "must use two synthetic tenants");
assert.ok(!verifier.includes("MNTY-PLATFORM"), "must not use a platform-tenant identity for isolation tests");
assert.ok(verifier.trimEnd().endsWith("ROLLBACK;"), "read-only verifier must rollback");
assert.ok(fixture.includes("\\if :{?mantiqati_disposable}") && fixture.includes("\\quit 3"), "fixture must fail closed unless explicit disposable flag is passed");
for (const marker of ["public.tenants", "public.organizations", "public.businesses", "public.user_memberships", "public.orders", "public.payment_intents", "public.account_registration_requests", "public.provider_onboarding_requests"]) {
  assert.ok(fixture.includes(marker) || fixture.includes(marker.replace("public.", "")), `fixture missing table ${marker}`);
}
assert.ok(fixture.includes("example.invalid") && fixture.includes("test_fixture"), "fixture must use synthetic non-routable identities and mark its rows as test data");
console.log("Tenant isolation verifier and synthetic fixture contract passed.");
