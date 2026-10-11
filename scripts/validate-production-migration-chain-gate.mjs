import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const source = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const required = [
  "20261009120000_rc425_atomic_mantigo_paymob_payment.sql",
  "20261009130000_rc426_digital_page_provider_order_binding.sql",
  "20261009140000_rc427_one_active_payment_intent_per_order.sql",
  "20261009150000_rc428_atomic_provider_failure_webhook.sql",
  "20261009160000_rc429_atomic_subscription_failure_webhook.sql",
  "20261009170000_rc430_atomic_subscription_success_webhook.sql",
  "20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql",
  "20261009190000_rc432_smm_wallet_transaction_idempotency.sql",
  "20261009200000_rc434_atomic_erp_purchase_receiving.sql",
  "20261009210000_rc435_subscription_provider_intent_claim.sql",
  "20261009220000_rc436_atomic_financial_journal.sql",
  "20261009230000_rc437_purchase_order_lines_receiving_limits.sql",
  "20261009240000_rc438_purchase_order_creation_with_lines.sql",
  "20261010010000_rc439_encrypted_checkout_recovery.sql",
  "20261010020000_rc440_exposed_security_definer_search_path.sql",
  "20261010030000_rc441_platform_admin_scope_hardening.sql",
  "20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql",
  "20261010120000_rc442_approval_action_audit_atomicity.sql",
  "20261010140000_rc444_crm_business_scope_rls.sql",
  "20261010150000_rc447_matrimony_profile_privacy_boundary.sql",
  "20261010161000_rc448_matrimony_request_lifecycle_authority.sql",
  "20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql",
  "20261010175000_rc449a_financial_journal_schema_prerequisites.sql",
  "20261010180000_rc450_financial_journal_service_role_boundary.sql",
  "20261010200000_rc451_targeted_ads_empty_search_path.sql",
  "20261010210000_rc452_marketing_crm_tenant_scope.sql",
  "20261010220000_rc453_marketing_campaign_backend.sql",
  "20261011010000_rc456_smm_service_role_access_boundary.sql"
];
assert.equal(required.length, 28, "release gate must track the complete 28-file migration source set");
const requiredTimestamps = required.map(name => name.slice(0, 14));
assert.deepEqual(requiredTimestamps, [...requiredTimestamps].sort(), "required migration list must be ordered by immutable timestamp, not RC number");
for (const name of required) assert.ok(source.includes(JSON.stringify(name)), `release verifier must track ${name}`);
assert.match(source, /migrationChainBlocked\?"BLOCKED":"PASS"/, "missing migrations or timestamp conflicts must block release certification");
assert.match(source, /r=>\(r\.status==="FAIL"\|\|r\.status==="BLOCKED"\)&&r\.severity==="P0"/, "P0 FAIL or BLOCKED checks must set production_gate=BLOCKED");
assert.match(source, /const nonProductionValidation=process\.env\.GITHUB_EVENT_NAME==="pull_request"\|\|\(process\.env\.GITHUB_EVENT_NAME==="push"&&process\.env\.GITHUB_REF!=="refs\/heads\/main"\);if\(results\.some\(r=>\(r\.status==="FAIL"\|\|r\.status==="BLOCKED"\)&&r\.severity==="P0"\)&&!nonProductionValidation\)process\.exitCode=1;/, "P0 gate blocks main/dispatch deployment while allowing PR and non-main branch validation");
assert.ok(workflow.includes("node scripts/validate-production-migration-chain-gate.mjs"), "Pages validation must run the release-chain gate contract");
assert.match(source, /migrationTimestampOrderViolations/, "migration timestamp/order conflicts must be checked");
assert.match(source, /const reconciliationPath="docs\/release\/production-migration-reconciliation\.json"/, "live reconciliation manifest must be read");
assert.match(source, /reconciliation\.source_ledger_identity_reconciled===true/, "source/ledger identity must be reconciled");
assert.match(source, /reconciliation\.rc424_reconciliation\?\.exact_statement_match===true/, "RC424 reconciliation must be backed by exact ledger statement equality");
assert.match(source, /reconciliation\.rc424_reconciliation\?\.history_rewritten===false/, "applied migration history must remain immutable");
assert.match(source, /reconciliation\.required_release_migrations_applied===true/, "all required migrations must be proven applied");
assert.match(source, /reconciliation\.chronological_replay==="PASS"/, "ordered disposable replay must pass");
assert.match(source, /reconciliation\.tenant_isolation_tests==="PASS"/, "tenant isolation acceptance must pass");
assert.match(source, /reconciliation\.payment_finance_e2e==="PASS"/, "payment and finance E2E must pass");
assert.match(source, /reconciliation\.backup_restore_rehearsal==="PASS"/, "backup/restore rehearsal must pass");
assert.match(source, /reconciliation\.edge_function_contracts==="PASS"/, "deployed Edge Function contracts must pass");
assert.match(source, /reconciliation\.smm_gateway_parity==="PASS"/, "SMM gateway deployment parity must pass");
assert.match(source, /reconciliation\.auth_security_settings==="PASS"/, "critical Auth security settings must pass");
const rc451 = fs.readFileSync("supabase/migrations/20261010200000_rc451_targeted_ads_empty_search_path.sql", "utf8");
assert.match(rc451, /alter function public\.get_mnty_targeted_advertisements\([\s\S]*?\) set search_path = '';/, "RC451 must harden the public targeted-ad SECURITY DEFINER search path");
assert.doesNotMatch(rc451, /\b(grant|revoke)\b/i, "RC451 must preserve the intentional public ad-discovery EXECUTE boundary");
assert.match(source, /!liveReconciliationVerified/, "missing live evidence must block release even when all migration files exist");
const runVerifier = event => spawnSync(process.execPath, ["scripts/production/verify-production.mjs"], {
  encoding: "utf8",
  env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_REF: event === "push" ? "refs/heads/main" : "refs/pull/193/merge" }
});
const prRun = runVerifier("pull_request");
assert.equal(prRun.status, 0, "PR validation must allow remediation while preserving a BLOCKED report");
assert.match(prRun.stdout, /PRODUCTION_GATE=BLOCKED/, "PR validation must still report the real blocked release state");
const productionRun = runVerifier("push");
assert.notEqual(productionRun.status, 0, "main push must exit non-zero while any P0 release gate is blocked");
assert.match(productionRun.stdout, /PRODUCTION_GATE=BLOCKED/, "production-mode check must report the blocker before failing");
console.log("Fail-closed production-mode execution test: PASS.");
console.log(`Production migration chain gate contract passed for ${required.length} required migration sources.`);
