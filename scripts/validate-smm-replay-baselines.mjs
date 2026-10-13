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
  provider_onboarding_requests: {
    path: path.join(baselineDir, "provider_onboarding_requests.sql"),
    version: "20261001085000",
    temporaryName: "20261001085000_test_only_approved_provider_onboarding_requests_baseline.sql",
  },
  digital_page_products: {
    path: path.join(baselineDir, "digital_page_products.sql"),
    version: "20261002095000",
    temporaryName: "20261002095000_test_only_live_derived_digital_page_products_baseline.sql",
  },
  digital_page_orders: {
    path: path.join(baselineDir, "digital_page_orders.sql"),
    version: "20261002095100",
    temporaryName: "20261002095100_test_only_live_derived_digital_page_orders_baseline.sql",
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
  if (table === "provider_onboarding_requests" || table === "digital_page_orders") {
    assert.ok(tableCreateMigration, table + " canonical CREATE TABLE migration must exist");
    assert.ok(firstReference.slice(0, 14) < tableCreateMigration.slice(0, 14), table + " migration-order defect must remain explicit");
  } else if (table === "digital_page_products") {
    assert.ok(tableCreateMigration, "digital page products canonical CREATE TABLE migration must exist");
    assert.ok(item.version < tableCreateMigration.slice(0, 14), "digital page products baseline must precede the canonical migration");
  } else {
    assert.doesNotMatch(allSource, new RegExp("\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:public\\.)?" + table + "\\b", "i"), table + " must not gain guessed or duplicate tracked CREATE TABLE DDL");
  }
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

const providerOnboarding = fs.readFileSync(baselines.provider_onboarding_requests.path, "utf8");
assert.match(providerOnboarding, /registration_request_id\s+uuid\s+not\s+null/i);
assert.match(providerOnboarding, /references\s+public\.account_registration_requests\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i);
assert.match(providerOnboarding, /references\s+auth\.users\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i);
assert.match(providerOnboarding, /provider_onboarding_requests_status_check[\s\S]*PENDING[\s\S]*APPROVED[\s\S]*REJECTED[\s\S]*CANCELLED/i);
assert.match(providerOnboarding, /enable\s+row\s+level\s+security/i);
assert.doesNotMatch(providerOnboarding, /force\s+row\s+level\s+security|create\s+policy/i);
const providerOnboardingAuthority = source["20261001090000_harden_provider_onboarding_authority.sql"];
const providerOnboardingCreate = source["20261001164200_provider_onboarding_final.sql"];
assert.ok(providerOnboardingAuthority && providerOnboardingCreate, "provider onboarding dependency and later canonical create migration must both exist");
assert.match(providerOnboardingAuthority, /drop\s+policy\s+if\s+exists\s+provider_onboarding_self_insert\s+on\s+public\.provider_onboarding_requests/i);
assert.match(providerOnboardingCreate, /create\s+table\s+if\s+not\s+exists\s+public\.provider_onboarding_requests/i);
assert.ok("20261001085000" < "20261001090000" && "20261001090000" < "20261001164200", "fixture must document rather than hide the out-of-order dependency");

const digitalPageProducts = fs.readFileSync(baselines.digital_page_products.path, "utf8");
assert.match(digitalPageProducts, /create table public\\.digital_page_products/i);
assert.match(digitalPageProducts, /code text not null[\\s\\S]*unique \\(code\\)/i);
assert.match(digitalPageProducts, /price numeric\\(12,2\\) not null[\\s\\S]*check \\(price >= 0\\)/i);
assert.match(digitalPageProducts, /enable row level security/i);
assert.doesNotMatch(digitalPageProducts, /create policy|insert\\s+into|update\\s+public\\.|delete\\s+from|copy\\s+(public|private)\\./i);
const digitalPageOrders = fs.readFileSync(baselines.digital_page_orders.path, "utf8");
assert.match(digitalPageOrders, /create table public\\.digital_page_orders/i);
assert.match(digitalPageOrders, /provider_intent_id text[\\s\\S]*provider_order_id text[\\s\\S]*provider_transaction_id text/i);
assert.match(digitalPageOrders, /unique \\(user_id, idempotency_key\\)/i);
assert.match(digitalPageOrders, /references public\\.digital_page_products\\(id\\)/i);
assert.match(digitalPageOrders, /enable row level security/i);
assert.doesNotMatch(digitalPageOrders, /create policy|insert\\s+into|update\\s+public\\.|delete\\s+from|copy\\s+(public|private)\\./i);
const digitalPageCreate = source["20261002190000_rc228_digital_page_products_orders.sql"];
const digitalPageIndexes = source["20261002100000_rc256_critical_fk_indexes.sql"];
assert.ok(digitalPageCreate && digitalPageIndexes, "digital-page baseline dependency and later canonical migration must both exist");
assert.match(digitalPageIndexes, /create index if not exists idx_digital_page_orders_product_id on public\\.digital_page_orders \\(product_id\\)/i);
assert.match(digitalPageCreate, /create table if not exists public\\.digital_page_orders/i);
assert.ok("20261002095000" < "20261002095100" && "20261002095100" < "20261002100000" && "20261002100000" < "20261002190000", "digital-page test fixtures must precede RC256 and explicitly preserve the RC256-before-RC228 source-order gap");

const credentials = fs.readFileSync(baselines.smm_provider_credentials.path, "utf8");
assert.match(credentials, /api_key_ciphertext\s+text\s*,/i);
assert.match(credentials, /configured\s+boolean\s+not\s+null\s+default\s+false/i);
assert.match(credentials, /references\s+public\.smm_providers\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i);
assert.match(credentials, /create\s+policy\s+mnty_deny_unexposed_client_access[\s\S]*to\s+anon\s*,\s*authenticated/i);
assert.doesNotMatch(allSource, /create\s+policy\s+mnty_deny_unexposed_client_access/i, "credentials deny policy must not be duplicated by a later migration");

console.log("SMM replay baseline contract PASS: six schema-only fixtures, source provenance, dependency order, policy ownership, and no-data rules.");
