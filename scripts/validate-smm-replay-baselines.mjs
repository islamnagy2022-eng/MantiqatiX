import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";

const migrationDir = "supabase/migrations";
const baselineDir = "supabase/tests/baselines";
const baselines = {
  smm_admins: {
    path: path.join(baselineDir, "smm_admins.sql"),
    version: "20260927033923",
    temporaryName: "20260927033923_test_only_approved_smm_admins_baseline.sql",
  },
  smm_providers: {
    path: path.join(baselineDir, "smm_providers.sql"),
    version: "20260927074158",
    temporaryName: "20260927074158_test_only_approved_smm_providers_baseline.sql",
  },
  smm_provider_credentials: {
    path: path.join(baselineDir, "smm_provider_credentials.sql"),
    version: "20260927074159",
    temporaryName: "20260927074159_test_only_approved_smm_provider_credentials_baseline.sql",
  },
};
const files = fs.readdirSync(migrationDir).filter(name => name.endsWith(".sql")).sort();
const source = Object.fromEntries(files.map(name => [name, fs.readFileSync(path.join(migrationDir, name), "utf8")]));
const allSource = files.map(name => source[name]).join("\n");
const noDataOps = /^\s*(?:insert\s+into|update\s+public\.|delete\s+from|copy\s+(?:public|private)\.)/im;

for (const [table, item] of Object.entries(baselines)) {
  assert.ok(fs.existsSync(item.path), table + " test-only baseline must exist");
  const body = fs.readFileSync(item.path, "utf8");
  assert.match(body, /TEST-ONLY SCHEMA BASELINE/, table + " baseline must be clearly test-only");
  assert.match(body, /moyhiluyhjsujhwlyeuu/, table + " baseline must name its production catalog source");
  assert.match(body, /read-only PostgreSQL catalog introspection|read-only catalog snapshot/, table + " baseline must name read-only provenance");
  assert.match(body, /Never apply this file to production/, table + " baseline must forbid production use");
  assert.doesNotMatch(body, noDataOps, table + " baseline must not contain data operations");
  assert.ok(!files.some(name => name.slice(0, 14) === item.version), table + " temporary baseline version must not collide with tracked history");
  assert.ok(!fs.existsSync(path.join(migrationDir, item.temporaryName)), table + " temporary baseline must never be committed under migrations");
  const firstReference = files.find(name => new RegExp("\\b" + table + "\\b", "i").test(source[name]));
  assert.ok(firstReference, table + " must have a tracked dependent migration");
  assert.ok(item.version < firstReference.slice(0, 14), table + " test baseline must precede its first dependency");
  const tableCreateMigration = files.find(name => new RegExp("\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?" + table + "\\b", "i").test(source[name]));
  assert.doesNotMatch(allSource, new RegExp("\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?" + table + "\\b", "i"), table + " must not gain guessed or duplicate tracked CREATE TABLE DDL");
}

const admins = fs.readFileSync(baselines.smm_admins.path, "utf8");
assert.match(admins, /user_id\s+uuid\s+not\s+null/i);
assert.match(admins, /primary\s+key\s*\(\s*user_id\s*\)/i);
assert.match(admins, /references\s+auth\.users\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i);
assert.match(admins, /enable\s+row\s+level\s+security/i);
assert.doesNotMatch(admins, /create\s+policy|force\s+row\s+level\s+security/i);

const providers = fs.readFileSync(baselines.smm_providers.path, "utf8");
assert.match(providers, /id\s+uuid\s+not\s+null\s+default\s+gen_random_uuid\(\)/i);
assert.match(providers, /api_url\s+text\s+not\s+null/i);
assert.match(providers, /primary\s+key\s*\(\s*id\s*\)/i);
assert.match(providers, /unique\s*\(\s*name\s*\)/i);
assert.match(providers, /enable\s+row\s+level\s+security/i);
assert.doesNotMatch(providers, /create\s+policy/i);
const policyMigration = source["20261001000000_security_hardening_private_tables_geo_rpc.sql"];
assert.ok(policyMigration, "chronological SMM policy migration must exist");
assert.match(policyMigration, /create\s+policy\s+"deny_direct_access_authenticated"\s+on\s+public\.smm_providers/i);
assert.match(policyMigration, /create\s+policy\s+"deny_direct_access_anon"\s+on\s+public\.smm_providers/i);

const credentials = fs.readFileSync(baselines.smm_provider_credentials.path, "utf8");
assert.match(credentials, /api_key_ciphertext\s+text\s*,/i);
assert.match(credentials, /configured\s+boolean\s+not\s+null\s+default\s+false/i);
assert.match(credentials, /references\s+public\.smm_providers\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i);
assert.match(credentials, /create\s+policy\s+mnty_deny_unexposed_client_access[\s\S]*to\s+anon\s*,\s*authenticated/i);
assert.doesNotMatch(allSource, /create\s+policy\s+mnty_deny_unexposed_client_access/i, "credentials deny policy must not be duplicated by a later migration");

console.log("SMM replay baseline contract PASS: three schema-only fixtures, source provenance, dependency order, policy ownership, and no-data rules.");
