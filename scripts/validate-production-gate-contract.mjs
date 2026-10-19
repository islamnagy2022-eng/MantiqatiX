#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const todo = read('docs/MASTER_PRODUCTION_TODO.md');
const continuity = read('docs/PROJECT_CONTINUITY.md');
const workflow = read('.github/workflows/pages.yml');
const productionGate = read('scripts/production/verify-production.mjs');

const requiredTodoMarkers = [
  'E2E مصادقة وصلاحيات متعددة المستخدمين/المؤسسات — NOT VERIFIED',
  'Paymob production E2E — WAIT',
  'Leaked Password Protection — WAIT',
  'Production release build + signing — WAIT',
  'Real-device release test — WAIT',
  'Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**',
];
const requiredContinuityMarkers = [
  'Final Production Gate remains **OPEN / NOT PRODUCTION READY YET**',
  'adversarial multi-tenant E2E',
  'real payment/finance',
  'backup/restore/rollback',
  'Android signed/device evidence',
];
const requiredWorkflowMarkers = [
  'validate-security-definer-contract.mjs',
  'validate-release-preflight.mjs',
  'validate-rbac-contract.mjs',
];

const home = read('web/home.js');
const requiredHomeMarkers = [
  'data-targeted-ad',
  "e.key==='Enter'||e.key===' '",
  'openMantiqatiAdModal(item)',
];

const requiredReleaseMigrationMarkers = [
  '20261009120000_rc425_atomic_mantigo_paymob_payment.sql',
  '20261009130000_rc426_digital_page_provider_order_binding.sql',
  '20261009140000_rc427_one_active_payment_intent_per_order.sql',
  '20261009150000_rc428_atomic_provider_failure_webhook.sql',
  '20261009160000_rc429_atomic_subscription_failure_webhook.sql',
  '20261009170000_rc430_atomic_subscription_success_webhook.sql',
  '20261009180000_rc431_harden_deployed_digital_page_payment_rpc.sql',
  '20261009190000_rc432_smm_wallet_transaction_idempotency.sql',
  '20261009200000_rc434_atomic_erp_purchase_receiving.sql',
  '20261009210000_rc435_subscription_provider_intent_claim.sql',
  '20261009220000_rc436_atomic_financial_journal.sql',
  '20261009230000_rc437_purchase_order_lines_receiving_limits.sql',
  '20261009240000_rc438_purchase_order_creation_with_lines.sql',
  '20261010010000_rc439_encrypted_checkout_recovery.sql',
  '20261010020000_rc440_exposed_security_definer_search_path.sql',
  '20261010030000_rc441_platform_admin_scope_hardening.sql',
  '20261010060000_rc446_mantigo_open_ride_privacy_boundary.sql',
  '20261010120000_rc442_approval_action_audit_atomicity.sql',
  '20261010140000_rc444_crm_business_scope_rls.sql',
  '20261010150000_rc447_matrimony_profile_privacy_boundary.sql',
  '20261010161000_rc448_matrimony_request_lifecycle_authority.sql',
  '20261010170000_rc449_mantigo_platform_admin_scope_hardening.sql',
  '20261010175000_rc449a_financial_journal_schema_prerequisites.sql',
  '20261010180000_rc450_financial_journal_service_role_boundary.sql',
  '20261010200000_rc451_targeted_ads_empty_search_path.sql',
  '20261010210000_rc452_marketing_crm_tenant_scope.sql',
  '20261010220000_rc453_marketing_campaign_backend.sql',
  '20261011010000_rc456_smm_service_role_access_boundary.sql',
  '20261019060000_rc454_marketing_partner_allocation_integrity.sql',
  '20261019070000_rc455_marketing_campaign_terminal_guard.sql',
  '20261019080000_rc456_marketing_partner_closure_backend.sql',
  '20261019090000_rc457_public_marketing_service_catalog.sql',
  '20261019100000_rc458_public_provider_profile_column_allowlist.sql',
  '20261019110000_rc459_profile_media_policy_regex_fix.sql',
];
const migrationArrayMatch = productionGate.match(/const requiredReleaseMigrations\s*=\s*\[([\s\S]*?)\];/);
if (!migrationArrayMatch) {
  console.error('RC360 production gate contract: FAIL');
  console.error('Required release migration manifest is missing.');
  process.exit(1);
}
const releaseMigrationManifest = migrationArrayMatch[1];
const releaseMigrationPositions = requiredReleaseMigrationMarkers.map(name => releaseMigrationManifest.indexOf(name));
if (releaseMigrationPositions.some(position => position < 0)) {
  console.error('RC360 production gate contract: FAIL');
  for (const name of requiredReleaseMigrationMarkers.filter(name => !releaseMigrationManifest.includes(name))) {
    console.error('MISSING RELEASE MIGRATION IN MANIFEST:', name);
  }
  process.exit(1);
}
if (releaseMigrationPositions.some((position, index) => index > 0 && position <= releaseMigrationPositions[index - 1])) {
  console.error('RC360 production gate contract: FAIL');
  console.error('Required release migrations are not in chronological manifest order.');
  process.exit(1);
}
const manifestMigrationNames = [...releaseMigrationManifest.matchAll(/["'](\d{14}_[^"']+\.sql)["']/g)].map(match => match[1]);
const duplicateManifestMigrations = manifestMigrationNames.filter((name, index) => manifestMigrationNames.indexOf(name) !== index);
if (duplicateManifestMigrations.length) {
  console.error('RC360 production gate contract: FAIL');
  console.error('Migration manifest contains duplicate filenames:', [...new Set(duplicateManifestMigrations)].join(', '));
  process.exit(1);
}
const timestampOrderViolations = manifestMigrationNames.slice(1).filter((name, index) =>
  name.slice(0, 14) < manifestMigrationNames[index].slice(0, 14)
);
if (timestampOrderViolations.length) {
  console.error('RC360 production gate contract: FAIL');
  console.error('Migration manifest contains timestamp order violations:', timestampOrderViolations.join(', '));
  process.exit(1);
}

const missing = [
  ...requiredHomeMarkers.filter(x => !home.includes(x)).map(x => 'HOME:' + x),
  ...requiredTodoMarkers.filter(x => !todo.includes(x)).map(x => 'TODO:' + x),
  ...requiredContinuityMarkers.filter(x => !continuity.includes(x)).map(x => 'CONTINUITY:' + x),
  ...requiredWorkflowMarkers.filter(x => !workflow.includes(x)).map(x => 'WORKFLOW:' + x),
];

if (missing.length) {
  console.error('RC360 production gate contract: FAIL');
  for (const item of missing) console.error('MISSING:', item);
  process.exit(1);
}

console.log('RC360 production gate contract: PASS');
console.log('Release documentation still explicitly blocks certification until critical external/runtime gates are evidenced.');