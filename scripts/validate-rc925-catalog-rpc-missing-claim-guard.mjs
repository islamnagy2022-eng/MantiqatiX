#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const migrationPath = "supabase/migrations/20261124150000_rc925_catalog_rpc_missing_anonymous_claim_guard.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const integration = fs.readFileSync(
  "supabase/tests/rc925_catalog_rpc_missing_anonymous_claim_integration.sql",
  "utf8",
);
const previousIntegration = fs.readFileSync(
  "supabase/tests/rc485_catalog_rpc_registry_root_integration.sql",
  "utf8",
);
const liveContract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const productionVerifier = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const migrationGate = fs.readFileSync("scripts/validate-production-migration-chain-gate.mjs", "utf8");
const manifest = JSON.parse(fs.readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));
const backupValidator = fs.readFileSync("scripts/validate-production-backup-runbook-current.mjs", "utf8");

const functions = [
  "adjust_catalog_stock_backend",
  "create_catalog_warehouse_backend",
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "upsert_catalog_settings_backend",
  "update_catalog_item_status_backend",
  "upsert_catalog_business_profile_backend",
];

const definitions = [...migration.matchAll(/CREATE OR REPLACE FUNCTION public\.([A-Za-z0-9_]+)\s*\(/gi)];
assert.equal(definitions.length, 7, "RC925 must replace exactly the seven catalog RPCs");
assert.deepEqual(
  definitions.map(match => match[1]).sort(),
  [...functions].sort(),
  "RC925 must replace the complete and only seven direct catalog RPCs",
);

for (const name of functions) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `RC925 must define ${name}`);
  const end = migration.indexOf("$function$;", start);
  assert.ok(end > start, `${name} function body must be complete`);
  const definition = migration.slice(start, end + "$function$;".length);
  assert.match(definition, /SET search_path TO ''/i, `${name} must retain empty search_path`);
  assert.match(
    definition,
    /\(auth\.jwt\(\)\s*->>\s*'is_anonymous'\)\s+IS DISTINCT FROM\s+'false'/i,
    `${name} must require the is_anonymous claim to be explicitly false`,
  );
  assert.doesNotMatch(
    definition,
    /coalesce\s*\(\s*\(\s*auth\.jwt\(\)\s*->>\s*'is_anonymous'/i,
    `${name} must not default a missing is_anonymous claim to false`,
  );
}

assert.match(migration, /RC925_REGISTRY_ROOT_CONTRACT_REQUIRED/);
assert.match(migration, /RC925_RC486_PRICE_SERIALIZATION_PREREQUISITE_FAILED/);
assert.match(migration, /RC925_POSTFLIGHT_MISSING_CLAIM_NOT_FAIL_CLOSED/);
assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);
assert.doesNotMatch(migration, /\bGRANT\b|\bREVOKE\b/i, "RC925 must preserve existing EXECUTE ACLs");
assert.doesNotMatch(
  migration,
  /\b(CREATE TABLE|ALTER TABLE|CREATE POLICY|DROP POLICY)\b/i,
  "RC925 must not create tables or change policies",
);

assert.match(integration, /'role','authenticated'/);
assert.match(integration, /auth\.uid\(\) IS DISTINCT FROM v_actor/);
assert.match(integration, /\(auth\.jwt\(\)\s*->>\s*'is_anonymous'\) IS NOT NULL/);
assert.match(integration, /RC925 confirmed-user and missing-claim boundaries verified across all seven catalog RPCs: PASS/);
assert.match(integration, /'is_anonymous',false/);
const confirmedUserMarkers = [
  "RC925_CONFIRMED_USER_REJECTED_ADJUST_STOCK",
  "RC925_CONFIRMED_USER_REJECTED_CREATE_WAREHOUSE",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_ITEM",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_PRICE",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_SETTINGS",
  "RC925_CONFIRMED_USER_REJECTED_UPDATE_STATUS",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_PROFILE",
];
for (const marker of confirmedUserMarkers) assert.ok(integration.includes(marker), `confirmed-user compatibility test missing: ${marker}`);
const missingClaimMarkers = {
  adjust_catalog_stock_backend: "ADJUST_STOCK",
  create_catalog_warehouse_backend: "CREATE_WAREHOUSE",
  upsert_catalog_item_backend: "UPSERT_ITEM",
  upsert_catalog_price_backend: "UPSERT_PRICE",
  upsert_catalog_settings_backend: "UPSERT_SETTINGS",
  update_catalog_item_status_backend: "UPDATE_ITEM_STATUS",
  upsert_catalog_business_profile_backend: "UPSERT_BUSINESS_PROFILE",
};
for (const name of functions) {
  assert.ok(integration.includes(`public.${name}(`), `missing-claim integration must call ${name}`);
  assert.ok(
    integration.includes(`RC925_MISSING_CLAIM_${missingClaimMarkers[name]}_BYPASS`),
    `missing-claim integration must assert bypass denial for ${name}`,
  );
}
assert.match(previousIntegration, /'is_anonymous',true/);
assert.match(previousIntegration, /RC923_ANONYMOUS_UPSERT_ITEM_BYPASS/);

assert.ok(liveContract.includes('"20261124150000"'), "live source contract must require RC925");
assert.ok(
  productionVerifier.includes("20261124150000_rc925_catalog_rpc_missing_anonymous_claim_guard.sql"),
  "Production verifier must require RC925 source",
);
assert.ok(
  migrationGate.includes("20261124150000_rc925_catalog_rpc_missing_anonymous_claim_guard.sql"),
  "strict migration gate must require RC925",
);
assert.match(migrationGate, /required\.length, 89/);
assert.equal(
  manifest.required_release_migration_ledger_check.expected_migration_versions,
  89,
  "manifest must use the 89-version contract",
);
assert.ok(
  manifest.required_release_migration_ledger_check.required_versions.includes("20261124150000"),
  "manifest must list RC925 as required",
);
assert.ok(
  manifest.required_release_migration_ledger_check.missing_versions.includes("20261124150000"),
  "RC925 must remain marked unapplied in Production",
);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261125110000"), "manifest must include RC926");
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261125110000"), "RC926 must remain unapplied in Production");
assert.ok(
  backupValidator.includes("CURRENT_RELEASE_MIGRATION_COUNT=89"),
  "backup runbook validator must use 89 required migrations",
);

console.log("RC925 explicit confirmed-identity catalog RPC contract: PASS (7 RPCs; missing claim denied; confirmed-user identity gate preserved; ACLs preserved)");
