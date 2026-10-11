import fs from "node:fs";
import assert from "node:assert/strict";

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
  "20261010120000_rc442_approval_action_audit_atomicity.sql",
  "20261010140000_rc444_crm_business_scope_rls.sql",
  "20261010145000_rc446_mantigo_open_ride_privacy_boundary.sql",
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
for (const name of required) assert.ok(source.includes(JSON.stringify(name)), `release verifier must track ${name}`);
assert.match(source, /migrationChainBlocked\?"BLOCKED":"PASS"/, "missing migrations or timestamp conflicts must block release certification");
assert.match(source, /r=>\(r\.status==="FAIL"\|\|r\.status==="BLOCKED"\)&&r\.severity==="P0"/, "P0 FAIL or BLOCKED checks must set production_gate=BLOCKED");
assert.match(source, /const nonProductionValidation=process\.env\.GITHUB_EVENT_NAME==="pull_request"\|\|\(process\.env\.GITHUB_EVENT_NAME==="push"&&process\.env\.GITHUB_REF!=="refs\/heads\/main"\);if\(results\.some\(r=>\(r\.status==="FAIL"\|\|r\.status==="BLOCKED"\)&&r\.severity==="P0"\)&&!nonProductionValidation\)process\.exitCode=1;/, "P0 gate blocks main/dispatch deployment while allowing PR and non-main branch validation");
assert.ok(workflow.includes("node scripts/validate-production-migration-chain-gate.mjs"), "Pages validation must run the release-chain gate contract");
assert.match(source, /migrationTimestampOrderViolations/, "migration timestamp/order conflicts must be checked");
console.log(`Production migration chain gate contract passed for ${required.length} required migration sources.`);
