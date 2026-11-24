import assert from "node:assert/strict";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20261124150000_rc501_is_platform_admin_caller_search_path.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc501_is_platform_admin_caller_search_path_fixture.sql", "utf8");
const integration = fs.readFileSync("supabase/tests/rc501_is_platform_admin_caller_search_path_integration.sql", "utf8");
const workflow = fs.readFileSync(".github/workflows/rc501-is-platform-admin-caller-search-path.yml", "utf8");
const contract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const productionVerifier = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const migrationGate = fs.readFileSync("scripts/validate-production-migration-chain-gate.mjs", "utf8");
const backupValidator = fs.readFileSync("scripts/validate-production-backup-runbook-current.mjs", "utf8");
const rc479Validator = fs.readFileSync("scripts/validate-rc479-anonymous-auth-session-boundary.mjs", "utf8");
const rc494Validator = fs.readFileSync("scripts/validate-rc494-settlement-financial-atomic-registry-scope.mjs", "utf8");
const manifest = JSON.parse(fs.readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));

const callers = [
  "public.create_notification_backend(character varying,character varying,uuid,character varying,character varying,text,character varying,character varying)",
  "public.deactivate_business(uuid,text)",
  "public.fashion_erp_mutate(text,jsonb,text)",
  "public.resolve_legacy_scope(text)",
  "public.restaurant_erp_mutate(text,jsonb,text)",
  "public.restaurant_table_mutate(text,jsonb,text)",
  "public.set_platform_feature_flag_backend(character varying,character varying,character varying,character varying,uuid,character varying,character varying,character varying,boolean,jsonb)",
];

assert.equal((migration.match(/ALTER FUNCTION public\./g) || []).length, 7,
  "RC501 must alter exactly seven existing SECURITY DEFINER callers");
for (const caller of callers) {
  assert.ok(migration.includes(caller), "missing exact RC501 function identity: " + caller);
  assert.ok(migration.includes("ALTER FUNCTION " + caller + "\n  SET search_path TO '';"),
    "caller is not pinned to the empty search_path: " + caller);
  assert.ok(fixture.includes("CREATE FUNCTION " + caller.split("(")[0]),
    "fixture must model caller: " + caller);
}
assert.match(migration,/RC501_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_NOT_HARDENED/);
assert.match(migration,/FROM private\.platform_admins/);
assert.match(migration,/FROM public\.user_memberships/);
assert.match(migration,/p\.proconfig IS DISTINCT FROM ARRAY\['search_path=public'\]/);
assert.match(migration,/CREATE TEMP TABLE rc501_caller_before ON COMMIT DROP/);
assert.match(migration,/p\.prosrc IS NOT DISTINCT FROM s\.prosrc/);
assert.match(migration,/p\.proacl IS NOT DISTINCT FROM s\.proacl/);
assert.match(migration,/p\.proowner IS NOT DISTINCT FROM s\.proowner/);
assert.match(migration,/array_replace\(\s*s\.proconfig,'search_path=public','search_path=""'/);
assert.doesNotMatch(migration,/\bGRANT\b|\bREVOKE\b|CREATE OR REPLACE FUNCTION|DROP FUNCTION|CREATE POLICY|ALTER TABLE/i,
  "RC501 must not replace function bodies or modify grants, tables, or policies");

for (const marker of [
  "RC501_EXPECTS_SEVEN_EMPTY_PATH_CALLERS",
  "RC501_CALLER_ACL_CHANGED",
  "RC501_REGISTERED_ROOT_REJECTED",
  "RC501_TENANT_ADMIN_ESCALATED_TO_PLATFORM_ROOT",
  "RC501_FEATURE_FLAG_TENANT_ADMIN_ESCALATED",
]) assert.ok(integration.includes(marker), "missing RC501 behavioral/ACL assertion: " + marker);
assert.match(integration,/search_path=""/);
assert.match(integration,/has_function_privilege\('service_role'/);
assert.match(integration,/private\.platform_admins/);
assert.ok(fixture.includes("ALTER TABLE private.platform_admins FORCE ROW LEVEL SECURITY"));
assert.ok(fixture.includes("REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC,anon,service_role"));
assert.ok(fixture.includes("GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated"));

assert.ok(contract.includes('"20261124150000"'),"RC501 must be in the canonical live migration contract");
assert.ok(productionVerifier.includes("20261124150000_rc501_is_platform_admin_caller_search_path.sql"));
assert.ok(migrationGate.includes("20261124150000_rc501_is_platform_admin_caller_search_path.sql"));
assert.match(migrationGate,/required\.length, 81/);
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions,81);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261124150000"));
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261124150000"));
assert.ok(backupValidator.includes("81 required migration IDs") && backupValidator.includes("0/81 exact required identifiers"));
assert.ok(rc479Validator.includes("expected_migration_versions, 81"));
assert.match(rc494Validator,/required\.length, 81/);
assert.match(rc494Validator,/expected_migration_versions, 81/);

assert.ok(workflow.includes("supabase/migrations/20261124150000_rc501_is_platform_admin_caller_search_path.sql"));
assert.ok(workflow.includes("scripts/validate-rc501-is-platform-admin-caller-search-path.mjs"));
console.log("RC501 seven platform-admin caller path contract: PASS");
