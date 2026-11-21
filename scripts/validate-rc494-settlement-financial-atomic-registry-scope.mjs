import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261120290000_rc494_settlement_financial_atomic_registry_scope_hardening.sql", "utf8");
const integration = readFileSync("supabase/tests/rc494_settlement_financial_atomic_registry_scope_integration.sql", "utf8");
const contract = readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
const verify = readFileSync("scripts/production/verify-production.mjs", "utf8");
const gate = readFileSync("scripts/validate-production-migration-chain-gate.mjs", "utf8");
const manifest = JSON.parse(readFileSync("docs/release/production-migration-reconciliation.json", "utf8"));
const workflow = readFileSync(".github/workflows/forward-migration-chain-replay.yml", "utf8");

assert.match(migration, /CREATE OR REPLACE FUNCTION public\.create_settlement_and_post_journal/);
assert.match(migration, /SET search_path = ''/);
assert.match(migration, /private\.platform_admins pa/);
assert.match(migration, /p_tenant_id = 'MNTY-PLATFORM'/);
assert.match(migration, /PLATFORM_ADMIN_REQUIRED/);
assert.match(migration, /BUSINESS_SCOPE_DENIED/);
assert.match(migration, /TENANT_FINANCE_SCOPE_REQUIRED/);
assert.match(migration, /branch_id IS NULL/);
assert.match(migration, /je\.business_id IS NOT DISTINCT FROM p_business_id/);
assert.match(migration, /v_existing\.gross_amount IS DISTINCT FROM p_gross/);
assert.match(migration, /v_existing\.net_payout IS DISTINCT FROM p_net/);
assert.match(migration, /RC494_PLATFORM_ADMIN_REGISTRY_RLS_NOT_FORCED/);
assert.match(migration, /RC494_SETTLEMENT_AND_REGISTRY_OWNER_BYPASS_MISMATCH/);
assert.match(migration, /RC494_PLATFORM_ADMIN_HELPER_SECURITY_CONTRACT_UNEXPECTED/);
assert.doesNotMatch(migration, /\bGRANT\b/i, "migration must not widen function or table privileges");
assert.doesNotMatch(migration, /\bDROP\b/i, "migration must remain additive/forward-only");

assert.match(integration, /RC494_REGISTERED_PLATFORM_ROOT_WITHOUT_MEMBERSHIP_DENIED/);
assert.match(integration, /RC494_MEMBERSHIP_ONLY_PLATFORM_ADMIN_SUCCEEDED/);
assert.match(integration, /RC494_CROSS_BUSINESS_SETTLEMENT_SUCCEEDED/);
assert.match(integration, /RC494_BUSINESS_ROLE_TENANT_WIDE_SETTLEMENT_SUCCEEDED/);
assert.match(integration, /RC494_TENANT_FINANCE_SCOPE_REGRESSED/);
assert.match(integration, /RC494_IDEMPOTENCY_AMOUNT_MISMATCH_WAS_ACCEPTED/);
assert.match(integration, /ROLLBACK;/);

assert.match(contract, /"20261120290000"/);
assert.match(verify, /20261120290000_rc494_settlement_financial_atomic_registry_scope_hardening\.sql/);
assert.match(gate, /required.length, 74/);
assert.equal(manifest.required_release_migration_ledger_check.expected_migration_versions, 74);
assert.ok(manifest.required_release_migration_ledger_check.required_versions.includes("20261120290000"));
assert.ok(manifest.required_release_migration_ledger_check.missing_versions.includes("20261120290000"));
assert.match(workflow, /validate-rc494-settlement-financial-atomic-registry-scope\.mjs/);
assert.match(workflow, /rc494_settlement_financial_atomic_registry_scope_integration\.sql/);

console.log("RC494_SETTLEMENT_REGISTRY_SCOPE=PASS");
