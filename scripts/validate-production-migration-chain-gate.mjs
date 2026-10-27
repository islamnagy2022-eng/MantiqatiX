import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isLiveReconciliationVerified, REQUIRED_RELEASE_MIGRATION_VERSIONS, REQUIRED_CORE_OBJECTS, REQUIRED_CONTROL_CENTER_OBJECTS, REQUIRED_MIGRATION_ALIASES } from "./production/live-reconciliation-contract.mjs";

const source = fs.readFileSync("scripts/production/verify-production.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/pages.yml", "utf8");
const liveContract = fs.readFileSync("scripts/production/live-reconciliation-contract.mjs", "utf8");
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
  "20261011010000_rc456_smm_service_role_access_boundary.sql",
  "20261014230000_rc525_digital_page_product_platform_admin_scope.sql",
  "20261023020000_rc102_provider_services_owner_write_grants.sql",
  "20261023030000_rc103_order_status_branch_scope.sql",
  "20261023040000_rc104_order_idempotency_scope.sql",
  "20261023050000_rc105_order_create_service_role_identity.sql",
  "20261023060000_rc106_order_status_service_role_identity.sql",
  "20261027030000_rc113_super_admin_control_center_foundation.sql",
  "20261027040000_rc114_business_employee_hiring_system.sql",
  "20261027050000_rc115_control_center_integration.sql",
  "20261027060000_rc116_business_subscriber_admin.sql",
  "20261027070000_rc117_default_images_and_activity_admin.sql",
  "20261027090000_rc113_user_membership_business_scope_idempotency.sql",
  "20261027093000_add_qadam_alsaad_homewares_store.sql"
];
assert.equal(required.length, 41, "release gate must track all distinct required post-RC424 migration effects");
const requiredTimestamps = required.map(name => name.slice(0, 14));
assert.deepEqual(requiredTimestamps, [...requiredTimestamps].sort(), "required migration list must be ordered by immutable timestamp, not RC number");
assert.deepEqual(requiredTimestamps, REQUIRED_RELEASE_MIGRATION_VERSIONS, "live ledger contract must cover the exact migration versions enforced by the verifier");
for (const name of required) assert.ok(source.includes(JSON.stringify(name)), `release verifier must track ${name}`);
assert.match(source, /migrationChainBlocked\?"BLOCKED":"PASS"/, "missing migrations or timestamp conflicts must block release certification");
assert.match(source, /r=>\(r\.status==="FAIL"\|\|r\.status==="BLOCKED"\)&&r\.severity==="P0"/, "P0 FAIL or BLOCKED checks must set production_gate=BLOCKED");
assert.match(source, /const nonProductionValidation=process\.env\.GITHUB_EVENT_NAME==="pull_request"\|\|\(process\.env\.GITHUB_EVENT_NAME==="push"&&process\.env\.GITHUB_REF!=="refs\/heads\/main"\);if\(results\.some\(r=>\(r\.status==="FAIL"\|\|r\.status==="BLOCKED"\)&&r\.severity==="P0"\)&&!nonProductionValidation\)process\.exitCode=1;/, "P0 gate blocks main/dispatch deployment while allowing PR and non-main branch validation");
assert.ok(workflow.includes("node scripts/validate-production-migration-chain-gate.mjs"), "Pages validation must run the release-chain gate contract");
assert.match(source, /migrationTimestampOrderViolations/, "migration timestamp/order conflicts must be checked");
assert.match(source, /const reconciliationPath="docs\/release\/production-migration-reconciliation\.json"/, "live reconciliation manifest must be read");
assert.match(liveContract, /source_ledger_identity_reconciled\s*===\s*true/, "source/ledger identity must be reconciled");
assert.match(liveContract, /rc424_reconciliation\?\.exact_statement_match\s*===\s*true/, "RC424 reconciliation must be backed by exact ledger statement equality");
assert.match(liveContract, /rc424_reconciliation\?\.history_rewritten\s*===\s*false/, "applied migration history must remain immutable");
assert.match(liveContract, /required_release_migrations_applied\s*===\s*true/, "all required migrations must be proven applied");
assert.match(liveContract, /chronological_replay\s*===\s*"PASS"/, "ordered disposable replay must pass");
assert.match(liveContract, /tenant_isolation_tests\s*===\s*"PASS"/, "tenant isolation acceptance must pass");
assert.match(liveContract, /payment_finance_e2e\s*===\s*"PASS"/, "payment and finance E2E must pass");
assert.match(liveContract, /backup_restore_rehearsal\s*===\s*"PASS"/, "backup/restore rehearsal must pass");
assert.match(liveContract, /edge_function_contracts\s*===\s*"PASS"/, "deployed Edge Function contracts must pass");
assert.match(liveContract, /smm_gateway_parity\s*===\s*"PASS"/, "SMM gateway deployment parity must pass");
assert.match(liveContract, /auth_security_settings\s*===\s*"PASS"/, "critical Auth security settings must pass");
const rc451 = fs.readFileSync("supabase/migrations/20261010200000_rc451_targeted_ads_empty_search_path.sql", "utf8");
assert.match(rc451, /alter function public\.get_mnty_targeted_advertisements\([\s\S]*?\) set search_path = '';/, "RC451 must harden the public targeted-ad SECURITY DEFINER search path");
assert.doesNotMatch(rc451, /\b(grant|revoke)\b/i, "RC451 must preserve the intentional public ad-discovery EXECUTE boundary");

assert.match(liveContract, /REQUIRED_RELEASE_MIGRATION_VERSIONS/, "the live ledger contract must enumerate all required migration versions");
assert.equal(REQUIRED_CORE_OBJECTS.length, 27, "release gate must require each payment, finance, ERP, and MantiGo core object independently");
assert.equal(REQUIRED_MIGRATION_ALIASES.length, 2, "release gate must reconcile duplicate source aliases through controlled migration repair");
assert.equal(REQUIRED_CONTROL_CENTER_OBJECTS.length, 33, "release gate must require every RC113–RC117 feature object");
assert.match(liveContract, /REQUIRED_CONTROL_CENTER_OBJECTS/, "control-center, hiring, subscriber-admin and default-image objects must be required");
assert.match(liveContract, /required_release_migration_ledger_check/, "exact live ledger version verification must be required");
assert.match(liveContract, /required_release_object_presence_check/, "selected production object contracts must be required");
assert.match(liveContract, /critical_edge_function_source_parity_check/, "deployed critical Edge Function parity must be required");
assert.match(liveContract, /financial_journal_runtime_prerequisite_check/, "journal schema and service-role RPC boundary must be required");
assert.match(liveContract, /security_definer_search_path_check/, "RC451 targeted-ad security-definer search_path must be required");
assert.match(liveContract, /REQUIRED_EDGE_FUNCTIONS/, "the live parity contract must enumerate all critical function entrypoints");

const validReconciliation = {
  status: "VERIFIED",
  verified: true,
  source_ledger_identity_reconciled: true,
  rc424_reconciliation: {
    exact_statement_match: true,
    ledger_version: "20261008222845",
    source_filename_version: "20261009010000",
    history_rewritten: false
  },
  required_release_migrations_applied: true,
  chronological_replay: "PASS",
  tenant_isolation_tests: "PASS",
  payment_finance_e2e: "PASS",
  backup_restore_rehearsal: "PASS",
  edge_function_contracts: "PASS",
  smm_gateway_parity: "PASS",
  auth_security_settings: "PASS",
  evidence_ref: "https://github.com/example/evidence",
  checked_at: "2026-10-27",
  required_release_migration_ledger_check: {
    status: "VERIFIED_APPLIED",
    expected_migration_versions: REQUIRED_RELEASE_MIGRATION_VERSIONS.length,
    found_in_live_ledger: REQUIRED_RELEASE_MIGRATION_VERSIONS.length,
    required_versions: REQUIRED_RELEASE_MIGRATION_VERSIONS,
    recorded_required_versions: REQUIRED_RELEASE_MIGRATION_VERSIONS,
    missing_versions: []
  },
  required_release_object_presence_check: {
    status: "PASS",
    observed: [
      { name: "required-object-fixture", exists: true, status: "PASS" },
      ...REQUIRED_CORE_OBJECTS.map(name => ({ name, exists: true, status: "PASS" })),
      ...REQUIRED_CONTROL_CENTER_OBJECTS.map(name => ({ name, exists: true, status: "PASS" }))
    ]
  },
  critical_edge_function_source_parity_check: {
    status: "PASS",
    functions: [
      { slug: "payment-intent", exact_match: true },
      { slug: "paymob-webhook", exact_match: true },
      { slug: "digital-page-payment-intent", exact_match: true },
      { slug: "subscription-payment-intent", exact_match: true },
      { slug: "financial-journal", exact_match: true },
      { slug: "smm-gateway", exact_match: true }
    ]
  },
  migration_alias_resolution_check: {
    status: "RECONCILED",
    expected_aliases: REQUIRED_MIGRATION_ALIASES.length,
    resolved_aliases: REQUIRED_MIGRATION_ALIASES.length,
    aliases: REQUIRED_MIGRATION_ALIASES.map(alias => ({
      ...alias,
      status: "RECONCILED",
      source_effect_verified: true,
      ledger_repair_applied: true
    }))
  },
  qadam_catalog_followup_check: {
    status: "PASS",
    migration_version: "20261027093000",
    migration_version_recorded: true,
    business_active: true,
    contact_fields_complete: true,
    owner_membership_status: "ACTIVE",
    owner_membership_active: true,
    expected_product_count: 15,
    active_product_count: 15,
    expected_price_rows: 12,
    matching_price_rows: 12,
    contact_for_price_product_count: 3,
    contact_for_price_without_active_price: 3,
    stock_tracking_enabled_item_count: 0
  },
  security_definer_search_path_check: {
    status: "PASS",
    migration_version: "20261010200000",
    migration_version_recorded: true,
    security_definer: true,
    current_search_path: [],
    expected_search_path: [],
    anon_execute: true,
    authenticated_execute: true
  },
  financial_journal_runtime_prerequisite_check: {
    status: "PASS",
    live_migrations: {
      "20261010175000_rc449a_financial_journal_schema_prerequisites": true,
      "20261010180000_rc450_financial_journal_service_role_boundary": true
    },
    schema_preflight: { missing_columns: [] },
    rpc_privileges: [
      { signature: "post_financial_journal_backend(uuid,jsonb,jsonb)", service_role_execute: true }
    ]
  }
};
const clone = value => JSON.parse(JSON.stringify(value));
assert.equal(isLiveReconciliationVerified(validReconciliation), true, "complete evidence fixture must satisfy the release contract");
const blockedFixtures = [
  value => { value.required_release_migration_ledger_check.found_in_live_ledger = 15; },
  value => { value.required_release_migration_ledger_check.missing_versions = ["20261009120000"]; },
  value => { value.required_release_object_presence_check.observed[0].status = "BLOCKED"; },
  value => { value.critical_edge_function_source_parity_check.functions.find(f => f.slug === "paymob-webhook").exact_match = false; },
  value => { value.financial_journal_runtime_prerequisite_check.live_migrations["20261010180000_rc450_financial_journal_service_role_boundary"] = false; },
  value => { value.financial_journal_runtime_prerequisite_check.schema_preflight.missing_columns = ["journal_entries.total_debit"]; },
  value => { value.financial_journal_runtime_prerequisite_check.rpc_privileges[0].service_role_execute = false; },
  value => { value.security_definer_search_path_check.current_search_path = ["search_path=public, pg_temp"]; },
  value => { value.security_definer_search_path_check.migration_version_recorded = false; },
  value => { value.required_release_migration_ledger_check.recorded_required_versions.pop(); },
  value => { value.migration_alias_resolution_check.resolved_aliases = 1; },
  value => { value.migration_alias_resolution_check.aliases[0].ledger_repair_applied = false; },
  value => { value.qadam_catalog_followup_check.owner_membership_active = false; },
  value => { value.qadam_catalog_followup_check.matching_price_rows = 11; },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.business_employees"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.mantigo_payment_provider_events"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.claim_subscription_provider_intent_creation_backend"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.journal_entries_tenant_entry_number_uidx"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.receive_purchase_stock_with_order_line_backend"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.get_mantigo_admin_dashboard_backend"); }
];
for (const mutate of blockedFixtures) {
  const invalid = clone(validReconciliation);
  mutate(invalid);
  assert.equal(isLiveReconciliationVerified(invalid), false, "live drift fixture must block certification");
}
console.log("Strict live-evidence fixtures (ledger, object drift, Edge Function parity, RC449A/RC450 schema/grants): PASS");

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
