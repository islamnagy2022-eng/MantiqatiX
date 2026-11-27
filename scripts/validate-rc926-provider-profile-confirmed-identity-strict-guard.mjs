import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20261125110000_rc926_provider_profile_confirmed_identity_strict_guard.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const integration = fs.readFileSync(
  "supabase/tests/rc926_provider_profile_confirmed_identity_strict_integration.sql",
  "utf8",
);
const liveContract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const productionVerifier = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const migrationGate = fs.readFileSync("scripts/validate-production-migration-chain-gate.mjs", "utf8");
const manifest = JSON.parse(fs.readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));
const backupValidator = fs.readFileSync("scripts/validate-production-backup-runbook-current.mjs", "utf8");

assert.match(migration, /RC926_PROVIDER_PROFILE_RLS_REQUIRED/);
assert.match(migration, /RC926_AUTHENTICATED_PROVIDER_PROFILE_SELECT_REQUIRED/);
assert.match(migration, /RC926_SERVICE_ROLE_PROVIDER_PROFILE_SELECT_REQUIRED/);
assert.match(migration, /REVOKE SELECT ON TABLE public\.marketing_provider_profiles FROM anon/);
assert.match(migration, /DROP POLICY IF EXISTS marketing_provider_profiles_confirmed_auth_select/);
assert.match(migration, /CREATE POLICY marketing_provider_profiles_confirmed_auth_select[\s\S]*?AS RESTRICTIVE[\s\S]*?FOR SELECT[\s\S]*?TO authenticated/);
assert.match(migration, /auth\.jwt\(\)\s*->>\s*'is_anonymous'[\s\S]*?IS NOT DISTINCT FROM\s*'false'/i);
assert.doesNotMatch(migration, /COALESCE\s*\([^)]*is_anonymous/i,
  "RC926 must not convert a missing identity claim into a confirmed user");
assert.doesNotMatch(migration, /FOR (ALL|INSERT|UPDATE|DELETE)/i,
  "RC926 must not alter owner DML behavior");
assert.doesNotMatch(migration, /\bDROP TABLE\b|\bTRUNCATE\b|\bDELETE FROM\b/i,
  "RC926 must not delete business data");

assert.ok(integration.includes("RC926 Synthetic Provider"), "RC926 must seed its own disposable provider row for schema-only replay");
assert.ok(integration.includes("RC926_DISPOSABLE_OWNER_AUTH_USER_FIXTURE_MISSING"), "RC926 must fail clearly if the disposable owner Auth fixture is absent");
assert.ok(integration.includes("f7914ac7-4b03-4456-afdd-e386f2ac6a5b"), "RC926 must use the deterministic replay prerequisite owner");
assert.ok(integration.includes("ON CONFLICT (id) DO UPDATE"), "RC926 fixture must be idempotent across the isolated test paths");

for (const marker of [
  "RC926_RAW_ANON_SELECT_STILL_GRANTED",
  "RC926_RAW_ANON_PROVIDER_PROFILE_READ_SUCCEEDED",
  "RC926_ANONYMOUS_AUTH_PROVIDER_PROFILE_READ_SUCCEEDED",
  "RC926_MISSING_ANONYMOUS_CLAIM_PROVIDER_PROFILE_READ_SUCCEEDED",
  "RC926_CONFIRMED_USER_READ_REGRESSED",
  "RC926_CONFIRMED_OWNER_UPDATE_REGRESSED",
  "RC926_WRONG_OWNER_UPDATE_SUCCEEDED",
  "RC926_STRICT_CONFIRMED_IDENTITY_POLICY_MISSING_OR_WEAK",
]) assert.ok(integration.includes(marker), "RC926 integration missing marker: " + marker);

assert.ok(liveContract.includes('"20261125110000"'), "live migration contract must require RC926");
assert.ok(productionVerifier.includes("20261125110000_rc926_provider_profile_confirmed_identity_strict_guard.sql"),
  "Production verifier must require RC926");
assert.ok(migrationGate.includes("20261125110000_rc926_provider_profile_confirmed_identity_strict_guard.sql"),
  "strict migration gate must require RC926");
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 88,
  "manifest must use the 88-version contract");
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261125110000"),
  "manifest must list RC926 as required");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261125110000"),
  "RC926 must remain unapplied in Production until coordinated release");
assert.ok(backupValidator.includes("CURRENT_RELEASE_MIGRATION_COUNT=88"),
  "backup runbook validator must use the 87-version contract");

console.log("RC926 strict provider-profile confirmed-identity source contract: PASS");

assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261125120000"), "manifest must list RC927");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261125120000"), "RC927 must remain unapplied in Production");
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261126010000"), "manifest must require RC928");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261126010000"), "manifest must keep RC928 unapplied until coordinated release");
