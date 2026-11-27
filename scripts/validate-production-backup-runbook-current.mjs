import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const runbook = read("docs/release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md");
const backlog = read("docs/release/WEBSITE_FIRST_LAUNCH_AND_POST_LAUNCH_BACKLOG_20261122.md");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
const securityDefinerInventory = read("docs/audits/PRODUCTION_SECURITY_DEFINER_INVENTORY_20261128.md");
const requiredObjectAudit = read("docs/audits/PRODUCTION_REQUIRED_79_OBJECT_READBACK_20261128.md");
const ledger = manifest.required_release_migration_ledger_check;

const runbookRequirements = [
  "supabase --version",
  "https://supabase.com/docs/reference/cli/supabase-db-dump",
  "excludes Supabase-managed schemas",
  'auth',
  'storage',
  "UNKNOWN / NOT EVIDENCED",
  "Restore to a new project",
  "Storage object bytes",
  "88 exact migration versions",
  "0/88 exact required version identifiers",
  "20261125120000",
  "RC927",
  "20261126010000",
  "RC928",
  "20261126020000",
  "RC117",
  "20261126030000",
  "RC929",
  "20261127010000",
  "RC930",
  "not applied to Production",
];
for (const required of runbookRequirements) {
  assert.ok(runbook.includes(required), "Current backup runbook is missing required scope: " + required);
}

const currentRunbookStart = runbook.indexOf("# CURRENT PRODUCTION RECHECK — 2026-11-28");
assert.ok(currentRunbookStart >= 0, "Backup runbook must start with the current 2026-11-28 Production gate.");
const currentRunbookEnd = runbook.indexOf("\n---\n", currentRunbookStart);
const currentRunbook = currentRunbookEnd > currentRunbookStart
  ? runbook.slice(currentRunbookStart, currentRunbookEnd)
  : runbook.slice(currentRunbookStart);
for (const required of [
  "310 rows through",
  "88 unique, chronologically ordered migration versions",
  "0/88",
  "79 canonical core/payment/control-center objects",
  "matched 37",
  "42 absent or non-matching",
  "149 functions owned by `postgres`",
  "65 effective `authenticated` EXECUTE",
  "one effective `anon` EXECUTE",
  "28 empty function-level `search_path`",
  "121 non-empty",
  "18 have an empty path and 47 a non-empty path",
  "166 findings (157 WARN / 9 INFO)",
  "Do not bulk-revoke or mass-change search_path",
  "Direct MantiGO live-RPC read-back",
  "get_mantigo_admin_dashboard_backend(uuid)",
  "get_mantigo_admin_financial_report_backend(uuid,timestamptz,timestamptz)",
  "settle_mantigo_captain_backend(uuid,text,text)",
  "expire_stale_mantigo_rides_backend(uuid,integer)",
  "the financial report aggregates the full MantiGO ledger",
  "20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql",
  "NOT VERIFIED / BLOCKED",
  "post_financial_journal_backend(uuid,jsonb,jsonb)",
  "service_role EXECUTE = false",
  "finalize_digital_page_payment_intent_backend(uuid,uuid,text,text)",
  "search_path=public, pg_temp",
  "finalize_digital_page_payment_intent_backend(uuid,uuid,text,text,text)",
  "create_subscription_payment_intent_claimable_backend(uuid,text,text,text,text,uuid)",
  "process_verified_mantigo_payment_backend",
  "Migration dependency map (source-only",
  "RC449A",
  "Financial journal source files",
  "RC449A restores/backfills journal header",
  "ERP purchasing source files",
  "RC434 atomic receipt is not sufficient for line-level receiving",
  "Directory claim/privacy source files",
  "20261118010000_rc472_directory_claim_review_atomicity.sql",
  "20261118020000_rc473_directory_listing_contact_consent.sql",
  "Platform-root source files",
  "20261113214500_rc464_platform_admin_live_registry_hardening.sql",
  "20261119040000_rc484_registry_backed_is_platform_admin.sql",
  "20261120200000_rc485_catalog_rpc_registry_root.sql",
  "Order/application source files",
  "20261126030000_rc929_orders_confirmed_auth_claim_guard.sql",
  "20261127010000_rc930_serialize_job_deactivation_and_application.sql",
  "20261009120000_rc425_atomic_mantigo_paymob_payment.sql",
  "20261010175000_rc449a_financial_journal_schema_prerequisites.sql",
  "20261010180000_rc450_financial_journal_service_role_boundary.sql",
  "20261009200000_rc434_atomic_erp_purchase_receiving.sql",
  "20261009230000_rc437_purchase_order_lines_receiving_limits.sql",
  "20261009240000_rc438_purchase_order_creation_with_lines.sql",
  "20261118010000_rc472_directory_claim_review_atomicity.sql",
  "20261118020000_rc473_directory_listing_contact_consent.sql",
  "20261027070000_rc117_default_images_and_activity_admin.sql",
  "20261113214500_rc464_platform_admin_live_registry_hardening.sql",
  "20261120200000_rc485_catalog_rpc_registry_root.sql",
  "20261126030000_rc929_orders_confirmed_auth_claim_guard.sql",
  "20261127010000_rc930_serialize_job_deactivation_and_application.sql",
]) {
  assert.ok(currentRunbook.includes(required), "Current Production backup overlay is missing: " + required);
}
assert.ok(!currentRunbook.includes("87-source"), "Current Production backup overlay must not retain a superseded 87-source gate.");
assert.ok(runbook.includes("exact ordered 88-source migration effects"), "Production release gate must reconcile the current 88-source migration chain.");


const backlogRequirements = [
  "88 required migration IDs",
  "0/88 exact required identifiers",
  "20261125110000",
  "RC926",
  "20261125120000",
  "RC927",
  "20261126010000",
  "RC928",
  "20261126020000",
  "RC117",
  "20261126030000",
  "RC929",
  "RC480",
  "RC927 is merged source-only",
];
for (const required of backlogRequirements) {
  assert.ok(backlog.includes(required), "Release backlog is missing current 88-version gate text: " + required);
}
assert.ok(!backlog.includes("76 required migration IDs"), "Release backlog still describes 76 as the current required migration count.");
assert.ok(!backlog.includes("0/76 present") && !backlog.includes("0/78 exact required identifiers"), "Release backlog still uses a superseded migration status.");

assert.equal(ledger.expected_migration_versions, 88, "manifest must use the 88-version contract");
assert.ok(ledger.required_versions.includes("20261125120000"), "manifest must list RC927");
assert.ok(ledger.missing_versions.includes("20261125120000"), "RC927 must remain explicitly unapplied in Production");
assert.ok(ledger.required_versions.includes("20261126010000"), "manifest must list RC928");
assert.ok(ledger.missing_versions.includes("20261126010000"), "RC928 must remain explicitly unapplied in Production");
assert.ok(ledger.required_versions.includes("20261126020000"), "manifest must list the RC117 image provenance repair");
assert.ok(ledger.missing_versions.includes("20261126020000"), "RC117 image provenance repair must remain unapplied in Production");
assert.ok(ledger.required_versions.includes("20261126030000"), "manifest must list RC929 orders confirmed-Auth guard");
assert.ok(ledger.missing_versions.includes("20261126030000"), "RC929 must remain unapplied to Production until coordinated release approval");
assert.ok(ledger.required_versions.includes("20261127010000"), "manifest must list RC930");
assert.ok(ledger.missing_versions.includes("20261127010000"), "RC930 must remain unapplied to Production until coordinated release approval");
assert.equal(ledger.found_in_live_ledger, 0, "do not manufacture or overstate Production migration ledger entries");

console.log("PRODUCTION_BACKUP_RUNBOOK_CURRENT_RELEASE_CONTRACT=PASS");
console.log("BACKUP_COVERAGE_AUTH_STORAGE_EXPLICIT=PASS");
console.log("CURRENT_RELEASE_MIGRATION_COUNT=88");
const missingObjectRows = requiredObjectAudit.match(/^\| `public\.[^`]+` \|/gm) ?? [];
const missingObjectNames = missingObjectRows.map((line) => line.split("|")[1].trim().slice(1, -1));
assert.equal(missingObjectRows.length, 42, "79-object read-back must itemize all 42 not-found exact contracts.");
assert.equal(new Set(missingObjectNames).size, 36, "42 grouped entries must represent 36 unique object/signature names with six documented Core/Payment overlaps.");
for (const required of [
  "20261009120000_rc425_atomic_mantigo_paymob_payment.sql",
  "20261009130000_rc426_digital_page_provider_order_binding.sql",
  "20261009140000_rc427_one_active_payment_intent_per_order.sql",
  "20261009150000_rc428_atomic_provider_failure_webhook.sql",
  "20261009160000_rc429_atomic_subscription_failure_webhook.sql",
  "20261009170000_rc430_atomic_subscription_success_webhook.sql",
  "20261009190000_rc432_smm_wallet_transaction_idempotency.sql",
  "20261009200000_rc434_atomic_erp_purchase_receiving.sql",
  "20261009210000_rc435_subscription_provider_intent_claim.sql",
  "20261009220000_rc436_atomic_financial_journal.sql",
  "20261009230000_rc437_purchase_order_lines_receiving_limits.sql",
  "20261009240000_rc438_purchase_order_creation_with_lines.sql",
  "20261010010000_rc439_encrypted_checkout_recovery.sql",
  "20261118010000_rc472_directory_claim_review_atomicity.sql",
  "RC472 itself repairs the missing index",
  "20261126020000_preserve_marketing_service_image_provenance.sql",
]) assert.ok(requiredObjectAudit.includes(required), "79-object read-back is missing source mapping: " + required);
const inventoryTableStart = securityDefinerInventory.indexOf("## Function-by-function metadata");
const inventoryTableEnd = securityDefinerInventory.indexOf("\n## Delegation review", inventoryTableStart);
assert.ok(inventoryTableStart >= 0 && inventoryTableEnd > inventoryTableStart, "SECURITY DEFINER inventory must include a complete function metadata table.");
const inventoryTable = securityDefinerInventory.slice(inventoryTableStart, inventoryTableEnd);
const inventoryRows = inventoryTable.match(/^\| `[^`]+` \| `postgres` \|/gm) ?? [];
const inventorySignatures = inventoryRows.map((line) => line.split("|")[1].trim().slice(1, -1));
assert.equal(inventoryRows.length, 149, "SECURITY DEFINER inventory must include all 149 live public-schema signatures.");
assert.equal(new Set(inventorySignatures).size, 149, "SECURITY DEFINER inventory signatures must be unique.");
for (const required of [
  "Effective anon EXECUTE: 1.",
  "Effective authenticated EXECUTE: 65.",
  "Effective service_role EXECUTE: 34.",
  "mnty_business_employee_list(tenant,business)",
  "mnty_can(permission,tenant,business,branch)",
  "mnty_can_platform_admin()",
  "preview_commission_backend(tenant,business,module,gross)",
  "upsert_catalog_item_and_price_backend(...)",
  "CONFIRMED P0 PLATFORM-ROOT DEFECT",
  "CONFIRMED P1 SCOPE DEFECT",
  "RC467 (`20261115010000`)",
]) {
  assert.ok(securityDefinerInventory.includes(required), "SECURITY DEFINER inventory is missing: " + required);
}
