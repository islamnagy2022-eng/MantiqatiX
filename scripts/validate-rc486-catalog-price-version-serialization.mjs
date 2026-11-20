import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261120210000_rc486_catalog_price_version_serialization.sql",
  "utf8",
);
const prior = fs.readFileSync(
  "supabase/migrations/20261120200000_rc485_catalog_rpc_registry_root.sql",
  "utf8",
);

const signature = "CREATE OR REPLACE FUNCTION public.upsert_catalog_price_backend(";
const block = source => {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, "price RPC definition must exist");
  const end = source.indexOf("$function$;", start);
  assert.notEqual(end, -1, "price RPC definition must terminate");
  return source.slice(start, end + "$function$;".length);
};
const current = block(migration);
const previous = block(prior);
const header = source => source.split(/\nRETURNS\b/i)[0];

assert.equal(header(current), header(previous), "RPC signature must remain unchanged");
assert.match(current, /SECURITY DEFINER/i);
assert.match(current, /SET search_path TO ''/i);
assert.match(current, /pg_catalog\.pg_advisory_xact_lock\s*\(/i,
  "price allocation must take a transaction-scoped advisory lock");
assert.ok(
  current.indexOf("pg_catalog.pg_advisory_xact_lock") < current.indexOf("SELECT coalesce(max(version)"),
  "the lock must be acquired before reading MAX(version)",
);
assert.match(migration, /GROUP BY catalog_item_id, coalesce\(branch_id, ''\), version[\s\S]*?HAVING count\(\*\) > 1/,
  "migration must fail closed on pre-existing duplicate item/branch/version groups");
assert.match(migration, /catalog_item_prices_item_branch_version_uidx/);
assert.match(migration, /coalesce\(branch_id, ''::character varying\)/);
assert.match(migration, /CREATE UNIQUE INDEX/i);
assert.match(migration, /RC486_NULL_CATALOG_PRICE_VERSION_REQUIRES_RECONCILIATION/);
console.log("RC486 source contract: PASS (stable RPC signature, lock-before-MAX, duplicate preflight, null-safe unique index)");
