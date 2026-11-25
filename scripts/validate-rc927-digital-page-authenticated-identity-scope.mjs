import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20261125120000_rc927_digital_page_authenticated_identity_scope.sql";
const testPath = "supabase/tests/rc927_digital_page_authenticated_identity_scope_integration.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const integration = fs.readFileSync(testPath, "utf8");
const liveContract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const productionVerifier = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const migrationGate = fs.readFileSync("scripts/validate-production-migration-chain-gate.mjs", "utf8");
const backupValidator = fs.readFileSync("scripts/validate-production-backup-runbook-current.mjs", "utf8");
const manifest = JSON.parse(fs.readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));
const forwardReplay = fs.readFileSync(".github/workflows/forward-migration-chain-replay.yml", "utf8");
const crosswalk = fs.readFileSync("docs/release/REQUIRED_84_MIGRATION_SOURCE_OBJECT_CROSSWALK_20261125.md", "utf8");

assert.match(migration, /RC927_DIGITAL_PAGES_RLS_REQUIRED/);
assert.match(migration, /RC927_DIGITAL_PAGE_SECTIONS_RLS_REQUIRED/);
assert.match(migration, /RC927_RC480_EXACT_TEN_COLUMN_ANON_ALLOWLIST_REQUIRED/);
for (const column of ["id", "page_type", "slug", "title", "subtitle", "description", "seo_title", "seo_description", "status", "version"]) {
  assert.ok(migration.includes(`has_column_privilege('anon','public.digital_pages','${column}','SELECT')`), `RC927 must preserve the RC480 public column: ${column}`);
}
for (const column of ["business_id", "provider_profile_id", "theme", "published_at", "created_by", "updated_by", "created_at", "updated_at", "digital_page_order_id"]) {
  assert.ok(migration.includes(`has_column_privilege('anon','public.digital_pages','${column}','SELECT')`), `RC927 must assert a negative grant boundary for ${column}`);
}
assert.match(migration, /has_column_privilege\('anon','public\.digital_pages','slug','SELECT'\)/);
assert.match(migration, /has_column_privilege\('anon','public\.digital_pages','created_by','SELECT'\)/);
assert.match(migration, /ALTER POLICY digital_pages_public_read[\s\S]*?TO anon/);
assert.match(migration, /ALTER POLICY digital_page_sections_public_read[\s\S]*?TO anon/);
assert.match(migration, /CREATE POLICY digital_pages_confirmed_auth_identity[\s\S]*?AS RESTRICTIVE[\s\S]*?FOR ALL[\s\S]*?TO authenticated/);
assert.match(migration, /CREATE POLICY digital_page_sections_confirmed_auth_identity[\s\S]*?AS RESTRICTIVE[\s\S]*?FOR ALL[\s\S]*?TO authenticated/);
assert.match(migration, /auth\.jwt\(\)\s*->>\s*'is_anonymous'[\s\S]*?IS NOT DISTINCT FROM\s*'false'/i);
assert.doesNotMatch(migration, /COALESCE\s*\([^)]*is_anonymous/i,
  "RC927 must not treat a missing/null anonymous claim as confirmed");
assert.doesNotMatch(migration, /\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b/i,
  "RC927 must not delete or truncate digital-page business data");
assert.doesNotMatch(migration, /\\bGRANT\\b|\\bREVOKE\\b/i,
  "RC927 must not expand or revoke table privileges; it changes only RLS policy roles and predicates");
assert.doesNotMatch(migration, /has_table_privilege\\('service_role'/i,
  "RC927 must not require service_role table grants that are absent in the current live contract");
assert.ok(migration.includes("digital_pages_owner_select"), "RC927 preflight must preserve the actual owner SELECT policy");
assert.ok(migration.includes("digital_pages_owner_insert"), "RC927 preflight must preserve the actual owner INSERT policy");
assert.ok(migration.includes("digital_pages_owner_update_draft"), "RC927 preflight must preserve the actual owner draft UPDATE policy");
assert.ok(migration.includes("digital_pages_admin_manage"), "RC927 preflight must preserve the global admin policy");
assert.ok(migration.includes("digital_page_sections_owner_manage"), "RC927 preflight must preserve section owner management");

for (const marker of [
  "RC927_RAW_ANON_PUBLISHED_PAGE_READ_FAILED",
  "RC927_RAW_ANON_PUBLIC_SECTION_READ_FAILED",
  "RC927_RAW_ANON_INTERNAL_OWNER_COLUMN_READ_SUCCEEDED",
  "RC927_RAW_ANON_WILDCARD_PAGE_READ_SUCCEEDED",
  "RC927_ANON_AUTH_PAGE_READ_SUCCEEDED",
  "RC927_ANON_AUTH_SECTION_READ_SUCCEEDED",
  "RC927_ANON_AUTH_PAGE_UPDATE_SUCCEEDED",
  "RC927_ANON_AUTH_SECTION_DELETE_SUCCEEDED",
  "RC927_ANON_AUTH_SECTION_INSERT_SUCCEEDED",
  "RC927_ANON_AUTH_PAGE_INSERT_SUCCEEDED",
  "RC927_MISSING_CLAIM_PAGE_READ_SUCCEEDED",
  "RC927_MISSING_CLAIM_PAGE_UPDATE_SUCCEEDED",
  "RC927_MISSING_CLAIM_PAGE_INSERT_SUCCEEDED",
  "RC927_CONFIRMED_OWNER_PRIVATE_PAGE_READ_REGRESSED",
  "RC927_CONFIRMED_OWNER_PAGE_UPDATE_REGRESSED",
  "RC927_CONFIRMED_OWNER_PAGE_INSERT_REGRESSED",
  "RC927_CONFIRMED_OWNER_SECTION_UPDATE_REGRESSED",
  "RC927_CONFIRMED_NON_OWNER_PUBLIC_PAGE_READ_SUCCEEDED",
  "RC927_CONFIRMED_NON_OWNER_PRIVATE_PAGE_READ_SUCCEEDED",
  "RC927_CONFIRMED_NON_OWNER_PAGE_UPDATE_SUCCEEDED",
  "RC927_PUBLIC_RENDERER_POLICY_MUST_TARGET_RAW_ANON_ONLY",
  "RC927_RESTRICTIVE_CONFIRMED_AUTH_POLICIES_MISSING",
]) assert.ok(integration.includes(marker), `RC927 integration is missing adversarial case: ${marker}`);

assert.ok(liveContract.includes('"20261125120000"'), "live migration contract must include RC927");
assert.ok(productionVerifier.includes("20261125120000_rc927_digital_page_authenticated_identity_scope.sql"),
  "production verifier must enumerate RC927");
assert.ok(migrationGate.includes("20261125120000_rc927_digital_page_authenticated_identity_scope.sql"),
  "strict release gate must enumerate RC927");
assert.match(migrationGate, /required\.length,\s*84/, "strict release gate must enforce 84 exact source migrations");
assert.ok(forwardReplay.includes("node scripts/validate-rc927-digital-page-authenticated-identity-scope.mjs"),
  "forward replay must execute RC927 source validation");
assert.ok(forwardReplay.includes(testPath), "forward replay must execute RC927 PostgreSQL integration");
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 84,
  "live reconciliation manifest must use the 84-source contract");
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261125120000"),
  "manifest must list RC927 as required");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261125120000"),
  "RC927 must remain unapplied in Production until the coordinated release");
assert.ok(backupValidator.includes("CURRENT_RELEASE_MIGRATION_COUNT=84"),
  "backup validator must use the 84-source contract");
assert.ok(crosswalk.includes("20261125120000") && crosswalk.includes("RC927"),
  "the 84-source source-to-live crosswalk must include RC927");

console.log("RC927 digital-page anonymous Auth isolation source contract: PASS");
