import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261125120000_rc927_digital_pages_anonymous_auth_read_guard.sql");
const integration = read("supabase/tests/rc927_digital_pages_anonymous_auth_read_guard_integration.sql");
const fixture = read("supabase/tests/rc480_digital_pages_anon_columns_fixture.sql");
const publicRenderer = read("web/digital-page.js");
const rc480Migration = read("supabase/migrations/20261118210000_rc480_digital_pages_anon_column_boundary.sql");
const liveContract = read("scripts/production/live-reconciliation-contract.mjs");
const productionVerifier = read("scripts/production/verify-production.mjs");
const migrationGate = read("scripts/validate-production-migration-chain-gate.mjs");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const backupValidator = read("scripts/validate-production-backup-runbook-current.mjs");

assert.match(
  migration,
  /CREATE\s+POLICY\s+digital_pages_confirmed_auth_select[\s\S]*?AS\s+RESTRICTIVE[\s\S]*?FOR\s+SELECT[\s\S]*?TO\s+authenticated/i,
  "RC927 must create a restrictive SELECT guard for authenticated-role sessions",
);
assert.ok(
  migration.includes("(SELECT (auth.jwt()->>'is_anonymous')::boolean) IS FALSE"),
  "RC927 must require explicit is_anonymous=false and deny missing/NULL claims",
);
assert.ok(migration.includes("RC927_RC480_ANON_TABLE_LEVEL_SELECT_STILL_GRANTED"));
assert.ok(migration.includes("RC927_RC480_PUBLIC_COLUMN_ALLOWLIST_NOT_PRESENT"));
assert.doesNotMatch(migration, /\bREVOKE\b|\bGRANT\b|DROP\s+POLICY/i,
  "RC927 must not change raw anon grants or replace public-read policies");
assert.ok(
  rc480Migration.includes("GRANT SELECT (") &&
  rc480Migration.includes("TO anon;"),
  "RC480's raw-anon public-column allowlist must remain the public renderer boundary",
);
assert.ok(fixture.includes("CREATE OR REPLACE FUNCTION auth.jwt()"));
assert.ok(fixture.includes("GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated"));
assert.ok(publicRenderer.includes("persistSession:false"));
assert.ok(publicRenderer.includes(".from('digital_pages').select('id,page_type,slug,title,subtitle,description,seo_title,seo_description,status,version')"));
assert.doesNotMatch(publicRenderer, /signInAnonymously\s*\(/,
  "Public page renderer must not introduce an anonymous Auth session");

for (const marker of [
  "RC927_ANON_AUTH_PUBLISHED_PAGE_READ_SUCCEEDED",
  "RC927_MISSING_CLAIM_PUBLISHED_PAGE_READ_SUCCEEDED",
  "RC927_CONFIRMED_AUTH_PUBLISHED_PAGE_READ_REGRESSED",
  "RC927_CONFIRMED_AUTH_INTERNAL_COLUMN_READ_REGRESSED",
  "RC927_RAW_ANON_PUBLIC_PAGE_READ_REGRESSED",
  "RC927_RAW_ANON_INTERNAL_COLUMN_BECAME_READABLE",
]) {
  assert.ok(integration.includes(marker), "missing RC927 behavior assertion: " + marker);
}

assert.ok(liveContract.includes('"20261125120000"'), "live migration contract must include RC927");
assert.ok(productionVerifier.includes("20261125120000_rc927_digital_pages_anonymous_auth_read_guard.sql"));
assert.ok(migrationGate.includes("20261125120000_rc927_digital_pages_anonymous_auth_read_guard.sql"));
assert.match(migrationGate, /required\.length, 84/);
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 84);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261125120000"));
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261125120000"));
assert.ok(backupValidator.includes("CURRENT_RELEASE_MIGRATION_COUNT=84"));

console.log("RC927 digital-pages Anonymous Auth base-row read guard: PASS");
