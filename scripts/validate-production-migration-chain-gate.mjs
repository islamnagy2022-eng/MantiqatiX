import fs from "node:fs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isLiveReconciliationVerified, REQUIRED_RELEASE_MIGRATION_VERSIONS, REQUIRED_CORE_OBJECTS, REQUIRED_PAYMENT_CONTRACT_OBJECTS, REQUIRED_CONTROL_CENTER_OBJECTS, REQUIRED_MIGRATION_ALIASES } from "./production/live-reconciliation-contract.mjs";

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
  "20261027093000_add_qadam_alsaad_homewares_store.sql",
  "20261031100000_rc463_trigger_only_security_definer_acl.sql",
  "20261113214500_rc464_platform_admin_live_registry_hardening.sql",
  "20261113220000_rc464b_orders_select_policy_preflight.sql",
  "20261114010000_rc465_orders_read_scope_hardening.sql",
  "20261114020000_rc466_business_branch_read_scope_hardening.sql",
  "20261115010000_rc467_commission_scope_hardening.sql",
  "20261115030000_rc468_digital_page_payment_claim_hardening.sql",
  "20261117010000_rc469_shared_platform_admin_caller_search_path.sql",
  "20261117020000_rc470_digital_page_webhook_forward_repair.sql",
  "20261117190000_rc471_mantigo_platform_admin_forward_hardening.sql",
  "20261118010000_rc472_directory_claim_review_atomicity.sql",
  "20261118020000_rc473_directory_listing_contact_consent.sql",
  "20261118030000_rc474_payment_intent_business_branch_scope.sql",
  "20261118040000_rc475_paymob_atomic_webhook_forward_repair.sql",
  "20261118050000_rc476_mantigo_captain_earnings_live_ledger_columns.sql",
  "20261118060000_rc477_mantigo_customer_bid_contact_privacy.sql",
  "20261118070000_rc478_mantigo_open_ride_privacy_forward_repair.sql",
  "20261118190000_rc479_revoke_anon_provider_profile_base_read.sql",
  "20261118210000_rc480_digital_pages_anon_column_boundary.sql",
  "20261118220000_rc481_legal_edge_service_role_column_grants.sql",
  "20261119020000_rc482_legal_platform_admin_registry_guard.sql",
  "20261119030000_rc483_atomic_legal_cms_create_audit.sql",
  "20261119040000_rc484_registry_backed_is_platform_admin.sql",
  "20261120200000_rc485_catalog_rpc_registry_root.sql",
  "20261120210000_rc486_catalog_price_version_serialization.sql",
  "20261120220000_rc487_remove_smm_first_user_admin_bootstrap.sql",
  "20261120230000_rc488_storage_anonymous_auth_write_guard.sql",
  "20261120240000_rc489_financial_anonymous_auth_read_guard.sql",
  "20261120250000_rc490_medical_anonymous_auth_read_guard.sql",
  "20261120260000_rc491_support_anonymous_auth_boundary.sql",
  "20261120270000_rc492_indrive_anonymous_auth_write_guard.sql",
  "20261120280000_rc493_private_crm_notification_read_guards.sql"
];
assert.equal(required.length, 73, "release gate must track all distinct required post-RC424 migration effects, including RC464B and RC476–RC493");
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
assert.equal(REQUIRED_CORE_OBJECTS.length, 31, "release gate must track granular payment, finance, ERP, and MantiGo object contracts");
assert.equal(REQUIRED_PAYMENT_CONTRACT_OBJECTS.length, 14, "release gate must pin exact RC435/RC439 payment and subscription RPC/column contracts");
assert.ok(REQUIRED_PAYMENT_CONTRACT_OBJECTS.includes("public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)"));
assert.ok(REQUIRED_PAYMENT_CONTRACT_OBJECTS.includes("public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)"));
assert.ok(REQUIRED_PAYMENT_CONTRACT_OBJECTS.includes("public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)"));
assert.ok(REQUIRED_PAYMENT_CONTRACT_OBJECTS.includes("public.claim_subscription_provider_intent_creation_backend(uuid,uuid)"));
assert.ok(REQUIRED_PAYMENT_CONTRACT_OBJECTS.includes("public.subscription_payment_intents.client_secret_ciphertext"));
assert.ok(REQUIRED_PAYMENT_CONTRACT_OBJECTS.includes("public.subscription_payment_intents.client_secret_key_version"));
assert.match(liveContract, /REQUIRED_PAYMENT_CONTRACT_OBJECTS/, "live release contract must require exact payment/subscription runtime objects");
assert.equal(REQUIRED_MIGRATION_ALIASES.length, 2, "release gate must reconcile duplicate source aliases through controlled migration repair");
assert.equal(REQUIRED_CONTROL_CENTER_OBJECTS.length, 33, "release gate must require every RC113–RC117 feature object");
assert.match(liveContract, /REQUIRED_CONTROL_CENTER_OBJECTS/, "control-center, hiring, subscriber-admin and default-image objects must be required");
assert.match(liveContract, /required_release_migration_ledger_check/, "exact live ledger version verification must be required");
assert.match(liveContract, /required_release_object_presence_check/, "selected production object contracts must be required");
assert.match(liveContract, /critical_edge_function_source_parity_check/, "deployed critical Edge Function parity must be required");
assert.match(liveContract, /financial_journal_runtime_prerequisite_check/, "journal schema and service-role RPC boundary must be required");
assert.match(liveContract, /security_definer_search_path_check/, "RC451 targeted-ad security-definer search_path must be required");
assert.match(liveContract, /REQUIRED_EDGE_FUNCTIONS/, "the live parity contract must enumerate all critical function entrypoints");


const forwardReplay = fs.readFileSync(".github/workflows/forward-migration-chain-replay.yml", "utf8");
const rc486Validator = fs.readFileSync("scripts/validate-rc486-catalog-price-version-serialization.mjs", "utf8");
const rc487Validator = fs.readFileSync("scripts/validate-rc487-smm-first-user-bootstrap-removal.mjs", "utf8");
const rc488Validator = fs.readFileSync("scripts/validate-rc488-storage-anonymous-auth-write-guard.mjs", "utf8");
assert.ok(forwardReplay.includes("node scripts/validate-rc486-catalog-price-version-serialization.mjs"), "forward replay must validate RC486 price serialization");
assert.ok(forwardReplay.includes("supabase/tests/rc486_catalog_price_version_serialization_integration.sql"), "forward replay must run the RC486 post-migration contract");
assert.ok(rc486Validator.includes("pg_catalog.pg_advisory_xact_lock"), "RC486 validator must check advisory lock");
assert.ok(rc486Validator.includes("the lock must be acquired before reading MAX(version)"), "RC486 validator must assert lock-before-MAX ordering");
assert.ok(forwardReplay.includes("node scripts/validate-rc487-smm-first-user-bootstrap-removal.mjs"), "forward replay must validate RC487 SMM bootstrap removal");
assert.ok(forwardReplay.includes("supabase/tests/rc487_smm_first_user_bootstrap_removal_integration.sql"), "forward replay must run the RC487 post-migration contract");
assert.ok(rc487Validator.includes("trg_smm_bootstrap_admin"), "RC487 validator must check removal of the first-user Auth trigger");
assert.ok(rc487Validator.includes("smm_bootstrap_first_admin"), "RC487 validator must check removal of the unsafe trigger function");
assert.ok(forwardReplay.includes("node scripts/validate-rc488-storage-anonymous-auth-write-guard.mjs"), "forward replay must validate RC488 Storage anonymous Auth write isolation");
assert.ok(rc488Validator.includes("storage_objects_confirmed_auth_delete"), "RC488 validator must check restrictive Storage write policies");
const forwardReplayLines = forwardReplay.split(/\r?\n/);
assert.ok(
  forwardReplayLines.some((line, index) => line === "  push:" && forwardReplayLines[index + 1] === "    branches: [main]"),
  "forward migration replay must run on main pushes and PRs, not every branch push, to avoid duplicate concurrent database containers"
);
assert.ok(
  forwardReplayLines.some((line, index) => line === "  pull_request:" && forwardReplayLines[index + 1] === '    branches: ["main"]'),
  "forward migration replay must validate pull requests targeting main"
);
for (const validator of [
  "scripts/validate-r7-platform-admin-migration.mjs",
  "scripts/validate-rc476-captain-earnings-live-columns.mjs",
  "scripts/validate-mantigo-high-risk-definers.mjs",
  "scripts/validate-rc482-legal-platform-admin-registry.mjs",
  "scripts/validate-rc483-atomic-legal-cms-create-audit.mjs",
  "scripts/validate-production-migration-chain-gate.mjs"
]) {
  assert.ok(forwardReplay.includes(validator), `forward replay must run ${validator}`);
}
for (const contractPath of [
  "scripts/production/live-reconciliation-contract.mjs",
  "scripts/production/verify-production.mjs",
  "docs/release/production-migration-reconciliation.json",
  "supabase/tests/rc482_legal_platform_admin_registry_integration.sql",
  "supabase/tests/rc483_atomic_legal_cms_create_audit_integration.sql"
]) {
  assert.ok(forwardReplay.includes(contractPath), `forward replay trigger paths must include ${contractPath}`);
}

const cleanupIfLine = forwardReplayLines.indexOf('          if [ -n "${MNTY_REPLAY_TEST_DIR:-}" ] && [ -d "$MNTY_REPLAY_TEST_DIR" ]; then');
assert.ok(cleanupIfLine >= 0, "forward replay cleanup must guard the disposable Supabase directory");
assert.equal(forwardReplayLines[cleanupIfLine + 1], '            cd "$MNTY_REPLAY_TEST_DIR"');
assert.equal(forwardReplayLines[cleanupIfLine + 2], "            supabase stop --no-backup || true");
assert.equal(forwardReplayLines[cleanupIfLine + 3], "          fi", "forward replay cleanup must close its shell conditional");

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
      ...REQUIRED_PAYMENT_CONTRACT_OBJECTS.map(name => ({ name, exists: true, status: "PASS" })),
      ...REQUIRED_CONTROL_CENTER_OBJECTS.map(name => ({ name, exists: true, status: "PASS" }))
    ]
  },
  critical_edge_function_source_parity_check: {
    status: "PASS",
    functions: [
      { slug: "order-create", exact_match: true },
      { slug: "api", exact_match: true },
      { slug: "order-status-update", exact_match: true },
      { slug: "payment-webhook", exact_match: true },
      { slug: "payment-intent", exact_match: true },
      { slug: "paymob-webhook", exact_match: true },
      { slug: "digital-page-payment-intent", exact_match: true },
      { slug: "subscription-payment-intent", exact_match: true },
      { slug: "financial-journal", exact_match: true },
      { slug: "smm-gateway", exact_match: true },
      { slug: "directory-listings", exact_match: true }
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
  trigger_only_security_definer_acl_check: {
    status: "PASS",
    migration_version: "20261031100000",
    migration_version_recorded: true,
    functions: [
      { function_name: "assign_default_owner_to_unowned_business", security_definer: true, trigger_enabled: true, search_path_empty: true, public_execute: false, anon_execute: false, authenticated_execute: false, service_role_execute: false },
      { function_name: "capture_commission_rule_audit", security_definer: true, trigger_enabled: true, search_path_empty: true, public_execute: false, anon_execute: false, authenticated_execute: false, service_role_execute: false }
    ]
  },
  directory_contact_consent_boundary: {
    status: "PASS",
    live_function: { slug: "directory-listings", exact_source_match: true, complete_bundle_match: true, required_files_present: true, missing_live_files: [], verify_jwt: false },
    consent_table_exists: true,
    public_get_contact_fields_consent_scoped: true,
    published_contact_rows_without_consent_exposure: 0,
    anonymous_contract_tests: "PASS",
    owner_consent_grant_revoke_tests: "PASS",
    registry_outage_fail_closed: true
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
  value => { value.critical_edge_function_source_parity_check.functions.find(f => f.slug === "order-create").exact_match = false; },
  value => { value.critical_edge_function_source_parity_check.functions.find(f => f.slug === "api").exact_match = false; },
  value => { value.critical_edge_function_source_parity_check.functions.find(f => f.slug === "directory-listings").exact_match = false; },
  value => { value.directory_contact_consent_boundary.status = "BLOCKED"; },
  value => { value.directory_contact_consent_boundary.live_function.complete_bundle_match = false; },
  value => { value.directory_contact_consent_boundary.live_function.missing_live_files = ["public-directory-output-contract.mjs"]; },
  value => { value.directory_contact_consent_boundary.consent_table_exists = false; },
  value => { value.directory_contact_consent_boundary.published_contact_rows_without_consent_exposure = 1; },
  value => { value.directory_contact_consent_boundary.registry_outage_fail_closed = false; },
  value => { value.critical_edge_function_source_parity_check.functions.find(f => f.slug === "order-status-update").exact_match = false; },
  value => { value.critical_edge_function_source_parity_check.functions.find(f => f.slug === "payment-webhook").exact_match = false; },
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
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.subscription_payment_intents.provider_creation_state"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.subscription_payment_intents.client_secret_ciphertext"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.claim_subscription_provider_intent_creation_backend(uuid,uuid)"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.process_verified_provider_payment_failure(text,text,text,text,text,text,boolean,numeric,text,text,text,jsonb)"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.process_verified_subscription_payment_backend(text,text,uuid,text,numeric,text,text,boolean,jsonb)"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.process_verified_subscription_payment_failure(text,text,uuid,text,numeric,text,text,boolean,jsonb)"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.process_verified_mantigo_payment_backend(text,text,text,boolean,numeric,text,text,jsonb)"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.subscription_payment_intents.provider_creation_claimed_at"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.subscription_payment_intents.client_secret_iv"); },
  value => { value.required_release_object_presence_check.observed = value.required_release_object_presence_check.observed.filter(row => (row.name ?? row.object) !== "public.subscription_payment_intents.client_secret_key_version"); }
];
for (const mutate of blockedFixtures) {
  const invalid = clone(validReconciliation);
  mutate(invalid);
  assert.equal(isLiveReconciliationVerified(invalid), false, "live drift fixture must block certification");
}
console.log("Strict live-evidence fixtures (ledger, object drift, Edge Function parity, directory contact consent, RC449A/RC450 schema/grants): PASS");

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