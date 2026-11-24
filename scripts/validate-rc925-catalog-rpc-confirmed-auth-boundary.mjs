import fs from "node:fs";
import assert from "node:assert/strict";

const rc485 = fs.readFileSync(
  "supabase/migrations/20261120200000_rc485_catalog_rpc_registry_root.sql",
  "utf8",
);
const rc923 = fs.readFileSync(
  "supabase/migrations/20261124121348_rc923_catalog_rpc_anonymous_auth_guard.sql",
  "utf8",
);
const migration = fs.readFileSync(
  "supabase/migrations/20261124192436_rc925_catalog_rpc_confirmed_auth_boundary.sql",
  "utf8",
);
const integration = fs.readFileSync(
  "supabase/tests/rc485_catalog_rpc_registry_root_integration.sql",
  "utf8",
);
const liveContract = fs.readFileSync(
  "scripts/production/live-reconciliation-contract.mjs",
  "utf8",
);
const productionVerifier = fs.readFileSync(
  "scripts/production/verify-production.mjs",
  "utf8",
);
const migrationGate = fs.readFileSync(
  "scripts/validate-production-migration-chain-gate.mjs",
  "utf8",
);
const manifest = JSON.parse(fs.readFileSync(
  "docs/release/production-migration-reconciliation.json",
  "utf8",
));

const functions = [
  "adjust_catalog_stock_backend",
  "create_catalog_warehouse_backend",
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "upsert_catalog_settings_backend",
  "update_catalog_item_status_backend",
  "upsert_catalog_business_profile_backend",
];
const rc923Overrides = new Set([
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "update_catalog_item_status_backend",
]);

function functionBlock(source, name) {
  const start = source.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const end = source.indexOf("$function$;", start);
  assert.notEqual(end, -1, `unterminated function ${name}`);
  return source.slice(start, end + "$function$;".length);
}

function signatureHeader(source, name) {
  return functionBlock(source, name).split(/\nRETURNS\b/i)[0];
}

assert.equal(
  (migration.match(/CREATE OR REPLACE FUNCTION public\./g) || []).length,
  7,
  "RC925 must replace exactly the seven registry-backed direct catalog RPCs",
);

for (const name of functions) {
  const prior = rc923Overrides.has(name) ? rc923 : rc485;
  const before = functionBlock(prior, name);
  const after = functionBlock(migration, name);

  assert.equal(
    signatureHeader(migration, name),
    signatureHeader(prior, name),
    `${name} signature must remain unchanged`,
  );
  assert.match(after, /SECURITY DEFINER/i, `${name} remains SECURITY DEFINER`);
  assert.match(after, /SET search_path TO ''/i, `${name} must retain an empty search_path`);
  assert.match(after, /public\.is_platform_admin\(\)/, `${name} must retain the registry-root path`);
  assert.match(
    after,
    /auth\.uid\(\)\s+IS\s+NULL\s+OR\s+\(auth\.jwt\(\)->>'is_anonymous'\)\s+IS\s+DISTINCT\s+FROM\s+'false'/i,
    `${name} must require an explicit is_anonymous=false claim`,
  );
  assert.doesNotMatch(
    after,
    /coalesce\s*\(\s*\(\s*auth\.jwt\(\)\s*->>\s*'is_anonymous'/i,
    `${name} must not treat a missing is_anonymous claim as false`,
  );
  assert.match(
    after,
    /'OWNER'|'BUSINESS_OWNER'|'ADMIN'/,
    `${name} must preserve tenant-local owner/admin permissions`,
  );
  assert.ok(before.length > 0);
}

const priceBlock = functionBlock(migration, "upsert_catalog_price_backend");
assert.match(priceBlock, /pg_catalog\.pg_advisory_xact_lock\s*\(/i,
  "RC925 must preserve RC486 transaction-scoped price serialization");
assert.ok(
  priceBlock.indexOf("pg_catalog.pg_advisory_xact_lock")
    < priceBlock.indexOf("SELECT coalesce(max(version)"),
  "RC925 must preserve the RC486 lock-before-MAX invariant",
);

assert.match(migration, /RC925_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_REQUIRED/);
assert.match(migration, /RC925_RC486_PRICE_SERIALIZATION_PRECONDITION_REQUIRED/);
assert.match(migration, /RC925_EXPLICIT_CONFIRMED_AUTH_GUARD_MISSING/);
assert.match(migration, /RC925_CATALOG_RPC_ACL_CHANGED/);
assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);
assert.doesNotMatch(migration, /\bGRANT\b|\bREVOKE\b/i,
  "RC925 must preserve existing owners and EXECUTE ACLs");

assert.match(integration, /SET ROLE authenticated[\s\S]*\$missing_claim\$/);
assert.match(integration, /jsonb_build_object\('sub',v_actor::text,'role','authenticated'\)/,
  "missing-claim fixture must omit is_anonymous instead of defaulting it to false");
assert.match(integration, /'is_anonymous',true/,
  "anonymous Auth behavior remains explicitly tested");
assert.match(integration, /'is_anonymous',false/,
  "confirmed-user behavior must be explicitly tested");
const missingClaimMarkers = [
  "RC925_MISSING_CLAIM_ADJUST_STOCK_BYPASS",
  "RC925_MISSING_CLAIM_CREATE_WAREHOUSE_BYPASS",
  "RC925_MISSING_CLAIM_UPSERT_ITEM_BYPASS",
  "RC925_MISSING_CLAIM_UPSERT_PRICE_BYPASS",
  "RC925_MISSING_CLAIM_UPSERT_SETTINGS_BYPASS",
  "RC925_MISSING_CLAIM_UPDATE_STATUS_BYPASS",
  "RC925_MISSING_CLAIM_UPSERT_PROFILE_BYPASS",
];
const confirmedUserMarkers = [
  "RC925_CONFIRMED_USER_REJECTED_ADJUST_STOCK",
  "RC925_CONFIRMED_USER_REJECTED_CREATE_WAREHOUSE",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_ITEM",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_PRICE",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_SETTINGS",
  "RC925_CONFIRMED_USER_REJECTED_UPDATE_STATUS",
  "RC925_CONFIRMED_USER_REJECTED_UPSERT_PROFILE",
];
for (const name of functions) {
  assert.ok(integration.includes(`public.${name}(`), `integration must directly call ${name}`);
}
for (const marker of missingClaimMarkers) assert.ok(integration.includes(marker), `missing claim denial test missing: ${marker}`);
for (const marker of confirmedUserMarkers) assert.ok(integration.includes(marker), `confirmed-user compatibility test missing: ${marker}`);

assert.ok(liveContract.includes('"20261124192436"'), "RC925 must be in the live version contract");
assert.ok(productionVerifier.includes("20261124192436_rc925_catalog_rpc_confirmed_auth_boundary.sql"),
  "Production verifier must require RC925");
assert.ok(migrationGate.includes("20261124192436_rc925_catalog_rpc_confirmed_auth_boundary.sql"),
  "strict migration gate must require RC925");
assert.match(migrationGate, /required\.length, 82/,
  "strict release gate must count RC925 in the 82-version chain");
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 82);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261124192436"));
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261124192436"));

console.log("RC925 direct catalog RPC confirmed-Auth boundary: PASS (7 functions; explicit false required)");
