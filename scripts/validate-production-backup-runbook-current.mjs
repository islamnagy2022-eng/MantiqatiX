import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const runbook = read("docs/release/PRODUCTION_BACKUP_RESTORE_DRILL_20261124.md");
const backlog = read("docs/release/WEBSITE_FIRST_LAUNCH_AND_POST_LAUNCH_BACKLOG_20261122.md");
const manifest = JSON.parse(read("docs/release/production-migration-reconciliation.json"));
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
  "20261027090000_rc113_user_membership_business_scope_idempotency.sql",
  "20261118010000_rc472_directory_claim_review_atomicity.sql",
  "20261118020000_rc473_directory_listing_contact_consent.sql",
  "Platform-root source files",
  "RC464 20261113214500_rc464_platform_admin_live_registry_hardening.sql",
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
