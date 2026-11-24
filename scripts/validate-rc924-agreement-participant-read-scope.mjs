import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261124140000_rc924_agreement_participant_read_scope.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc924_agreement_participant_read_scope_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc924_agreement_participant_read_scope_integration.sql", "utf8");
const rc482 = fs.readFileSync("supabase/migrations/20261119020000_rc482_legal_platform_admin_registry_guard.sql", "utf8");
const rc482Integration = fs.readFileSync("supabase/tests/rc482_legal_platform_admin_registry_integration.sql", "utf8");
const rc482Validator = fs.readFileSync("scripts/validate-rc482-legal-platform-admin-registry.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/rc924-agreement-participant-read-scope.yml", "utf8");

assert.match(migration,/DROP POLICY IF EXISTS agreements_participant_read ON public\.agreements/i);
assert.match(migration,/CREATE POLICY agreements_participant_read[\s\S]*?ON public\.agreements[\s\S]*?FOR SELECT\s+TO authenticated/i);
assert.match(migration,/CREATE POLICY agreements_confirmed_auth_select[\s\S]*?AS RESTRICTIVE[\s\S]*?FOR SELECT\s+TO authenticated/i);
assert.match(migration,/ap\.agreement_id\s*=\s*agreements\.id/i);
assert.match(migration,/ap\.user_id\s*=\s*\(SELECT auth\.uid\(\)\)/i);
assert.match(migration,/private\.legal_is_admin\(\(SELECT auth\.uid\(\)\)\)/i);
assert.match(migration,/is_anonymous'\)::boolean\s+IS\s+FALSE/i);
assert.doesNotMatch(migration,/COALESCE\([\s\S]*?is_anonymous/i);
assert.doesNotMatch(migration,/GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)\s+ON\s+TABLE/i);
assert.doesNotMatch(migration,/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM/i);

for (const marker of [
  "ap.agreement_id = ap.id",
  "RC924_PARTICIPANT_A_SCOPE_FAILURE",
  "RC924_PARTICIPANT_B_SCOPE_FAILURE",
  "RC924_PARTICIPANT_ROWS_A_SCOPE_FAILURE",
  "RC924_UNRELATED_USER_READS_AGREEMENTS",
  "RC924_ANONYMOUS_AUTH_USER_READS_AGREEMENTS",
  "RC924_MISSING_ANONYMOUS_CLAIM_READS_AGREEMENTS",
  "RC924_PLATFORM_ADMIN_SCOPE_FAILURE",
]) assert.ok(fixture.includes(marker) || integration.includes(marker), "missing RC924 regression case: "+marker);

assert.match(integration,/agreements\.id/);
assert.match(integration,/is_anonymous":true/);
assert.match(fixture,/FROM private\.platform_admins pa/);
assert.match(fixture,/CREATE TABLE public\.user_memberships/);
assert.match(fixture,/ALTER TABLE private\.platform_admins ENABLE ROW LEVEL SECURITY/);
assert.match(fixture,/ALTER TABLE private\.platform_admins FORCE ROW LEVEL SECURITY/);
assert.match(fixture,/REVOKE ALL ON FUNCTION private\.legal_is_admin\(uuid\) FROM PUBLIC/);
assert.match(fixture,/REVOKE ALL ON FUNCTION private\.legal_is_admin\(uuid\) FROM anon/);
for (const role of ["'ADMIN'","'SUPER_ADMIN'","'LEGAL_ADMIN'"]) {
  assert.ok(fixture.includes(role), "missing RC924 tenant role fixture: "+role);
}
assert.match(integration,/agreements_confirmed_auth_select/);
assert.match(integration,/permissive='RESTRICTIVE'/);
assert.match(integration,/agreements_admin_write/);
assert.match(integration,/permissive='PERMISSIVE'/);
assert.match(integration,/RC924_TENANT_ROLE_ESCALATED_TO_PLATFORM_LEGAL_ADMIN/);
assert.match(integration,/RC924_TENANT_ROLE_IMPERSONATED_PLATFORM_ADMIN/);
assert.match(integration,/RC924_TENANT_ROLE_READ_CROSS_BUSINESS_AGREEMENTS/);
assert.ok(integration.includes("RESET ROLE;\n\nSET ROLE authenticated;\n\n-- An authenticated but unrelated user"), "RLS actor checks must run under authenticated after resetting from the tenant-role block");


assert.match(migration,/RC924_LEGAL_ADMIN_HELPER_IS_NOT_REGISTRY_BACKED/);
assert.match(migration,/FROM private\.platform_admins/i);
assert.match(migration,/public\.user_memberships/i);
assert.match(migration,/search_path=""/);
assert.match(migration,/has_function_privilege\('anon',[\s\S]*private\.legal_is_admin\(uuid\)/);
assert.match(rc482,/FROM private\.platform_admins/i);
assert.doesNotMatch(rc482,/FROM public\.user_memberships/i);
assert.ok(rc482Integration.includes("RC482_BUSINESS_ADMIN_ESCALATED_TO_GLOBAL_LEGAL_ADMIN"));
assert.ok(rc482Integration.includes("RC482_LEGAL_ADMIN_LABEL_ESCALATED_WITHOUT_ROOT_REGISTRY"));
assert.ok(rc482Validator.includes("canonical platform-admin registry"));
assert.ok(workflow.includes("node scripts/validate-rc482-legal-platform-admin-registry.mjs"));
assert.ok(workflow.indexOf("rc482.sql") < workflow.indexOf("rc924.sql"),"RC482 must run before RC924");
assert.ok(workflow.indexOf("rc482-integration.sql") < workflow.indexOf("rc924.sql"),"RC482 integration must pass before RC924");
assert.ok(workflow.includes("grep -Fq 'RC924_LEGAL_ADMIN_HELPER_IS_NOT_REGISTRY_BACKED'"),"workflow must verify the expected RC924 fail-closed preflight");

console.log("RC924 agreement participant read-scope contract: PASS");
