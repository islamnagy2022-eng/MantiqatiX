import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010080000_rc566_crm_business_read_scope.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc566_crm_business_scope_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc566_crm_business_scope_integration.sql", "utf8");

assert.ok(migration.includes("um.business_id = marketing_leads.requester_business_id"), "lead manager reads must match requester business");
assert.ok(migration.includes("um.business_id = marketing_provider_profiles.business_id"), "provider manager reads must match provider business");
assert.ok((migration.match(/um\.tenant_id = 'MNTY-PLATFORM'/g) || []).length === 2, "platform bypass must be explicit and tenant-bound for both tables");
assert.ok((migration.match(/'SUPER_ADMIN'/g) || []).length >= 2, "platform-wide reads must require SUPER_ADMIN");
assert.ok((migration.match(/full_control/g) || []).length === 2, "platform-wide reads must require full_control");
assert.ok(fixture.includes("CREATE POLICY \"Public can view active marketing providers\""), "fixture must preserve the public active-provider path");
for (const contract of [
  "business A manager read business B lead",
  "business A manager read pending provider from business B",
  "inactive business membership must not grant CRM lead reads",
  "tenant-scoped SUPER_ADMIN must not gain platform-wide CRM read",
  "explicit platform admin should see all CRM leads"
]) {
  assert.ok(integration.includes(contract), "missing integration assertion: " + contract);
}
console.log("RC566 CRM business read-scope source contract: PASS");
