import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120200000_rc485_catalog_rpc_registry_root.sql",
  "utf8",
);
const anonymousGuard = fs.readFileSync(
  "supabase/migrations/20261124121348_rc923_catalog_rpc_anonymous_auth_guard.sql",
  "utf8",
);
const integration = fs.readFileSync(
  "supabase/tests/rc485_catalog_rpc_registry_root_integration.sql",
  "utf8",
);
const prior = fs.readFileSync(
  "supabase/migrations/20261026092940_rc107_catalog_manager_business_branch_scope.sql",
  "utf8",
);
const profilePrior = fs.readFileSync(
  "supabase/migrations/20261027111500_preserve_catalog_profile_metadata.sql",
  "utf8",
);

const functions = [
  "adjust_catalog_stock_backend",
  "create_catalog_warehouse_backend",
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "upsert_catalog_settings_backend",
  "update_catalog_item_status_backend",
  "upsert_catalog_business_profile_backend",
];
const anonymousOverrides = new Set([
  "upsert_catalog_item_backend",
  "upsert_catalog_price_backend",
  "update_catalog_item_status_backend",
]);
const effectiveMigration = migration + "\n" + anonymousGuard;

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

for (const name of functions) {
  const oldSource = name === "upsert_catalog_business_profile_backend" ? profilePrior : prior;
  const oldBlock = functionBlock(oldSource, name);
  const newBlock = functionBlock(effectiveMigration, name);

  assert.equal(signatureHeader(effectiveMigration, name), signatureHeader(oldSource, name),
    `${name} signature must remain unchanged`);
  assert.match(newBlock, /SECURITY DEFINER/i, `${name} must remain SECURITY DEFINER`);
  assert.match(newBlock, /SET search_path TO ''/i, `${name} must pin search_path to empty`);
  assert.doesNotMatch(newBlock, /SET search_path TO 'public'/i, `${name} must not retain public search_path`);
  assert.match(newBlock, /public\.is_platform_admin\(\)/,
    `${name} platform-root path must use the RC484 registry helper`);
  assert.match(newBlock, /auth\.jwt\(\)->>'is_anonymous'/i,
    `${name} must reject Anonymous Auth sessions at the direct RPC boundary`);
  assert.doesNotMatch(newBlock, /permissions\s*->>\s*'scope'|permissions\s*->>\s*'full_control'/i,
    `${name} must not trust mutable tenant membership metadata for platform-root authority`);
  assert.match(newBlock, /'OWNER'|'BUSINESS_OWNER'|'ADMIN'/,
    `${name} must preserve tenant-local owner/admin permissions`);
  assert.ok(oldBlock.length > 0);
}

const priceBlock = functionBlock(effectiveMigration, "upsert_catalog_price_backend");
assert.match(priceBlock, /pg_catalog\.pg_advisory_xact_lock\s*\(/i,
  "RC923 must preserve RC486 transaction-scoped price serialization");
assert.ok(
  priceBlock.indexOf("pg_catalog.pg_advisory_xact_lock") < priceBlock.indexOf("SELECT coalesce(max(version)"),
  "RC923 must preserve the RC486 lock-before-MAX invariant",
);
assert.match(anonymousGuard, /RC923_RC486_PRICE_SERIALIZATION_PRECONDITION_REQUIRED/);
assert.match(anonymousGuard, /RC923_PRICE_SERIALIZATION_LOCK_LOST/);

assert.equal((anonymousGuard.match(/CREATE OR REPLACE FUNCTION public\./g) || []).length, 3,
  "RC923 must only replace the three RPCs missing the anonymous-session guard");
assert.equal((anonymousGuard.match(/auth\.jwt\(\)->>'is_anonymous'/g) || []).length, 3,
  "RC923 must add exactly one anonymous-session guard to each replacement RPC");
assert.match(anonymousGuard, /RC923_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_REQUIRED/);
assert.match(anonymousGuard, /RC923_RC485_PRECONDITION_FAILED/);
assert.match(anonymousGuard, /RC923_POSTFLIGHT_ANONYMOUS_AUTH_GUARD_OR_ACL_FAILED/);
assert.match(anonymousGuard, /BEGIN;/);
assert.match(anonymousGuard, /COMMIT;/);
assert.doesNotMatch(anonymousGuard, /\bGRANT\b|\bREVOKE\b/i,
  "RC923 must preserve the existing owner and EXECUTE ACLs");

assert.match(migration, /RC485_REGISTRY_BACKED_PLATFORM_ADMIN_HELPER_REQUIRED/);
assert.match(migration, /private\.platform_admins/);
assert.match(migration, /search_path=""/);
assert.match(migration, /BEGIN;/);
assert.match(migration, /COMMIT;/);

assert.match(integration, /SET ROLE authenticated/);
assert.match(integration, /'is_anonymous',true/);
for (const name of functions) {
  assert.ok(integration.includes(`public.${name}(`), `anonymous test must call ${name}`);
}
assert.match(integration, /RC923_ANONYMOUS_ADJUST_STOCK_BYPASS/);
assert.match(integration, /RC923_ANONYMOUS_CREATE_WAREHOUSE_BYPASS/);
assert.match(integration, /RC923_ANONYMOUS_UPSERT_ITEM_BYPASS/);
assert.match(integration, /RC923_ANONYMOUS_UPSERT_PRICE_BYPASS/);
assert.match(integration, /RC923_ANONYMOUS_UPSERT_SETTINGS_BYPASS/);
assert.match(integration, /RC923_ANONYMOUS_UPDATE_ITEM_STATUS_BYPASS/);
assert.match(integration, /RC923_ANONYMOUS_UPSERT_BUSINESS_PROFILE_BYPASS/);

console.log("RC485/RC923 catalog RPC security contract: PASS (7 registry-root RPCs, 7 anonymous-session denials)");
