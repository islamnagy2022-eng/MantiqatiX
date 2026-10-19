#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const todo = read('docs/MASTER_PRODUCTION_TODO.md');
const continuity = read('docs/PROJECT_CONTINUITY.md');
const workflow = read('.github/workflows/pages.yml');
const productionVerifier = read('scripts/production/verify-production.mjs');

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

const requiredProductionGateMarkers = [
  '"20261014233000_rc526_mantigo_payment_intent_claim.sql"',
  '"20261016100000_digital_page_payment_intent_server_only_finalization.sql"',
  '"20261019150000_rc531_business_registration_atomicity.sql"',
  'const missingReleaseMigrations=requiredReleaseMigrations.filter',
  'reconciliation.status==="VERIFIED"',
  'add("MANTIGO-PAY-CLAIM"',
  'add("MANTIGO-PAY-FINALIZE"',
  'add("MANTIGO-PAY-RELEASE"',
  'add("MANTIGO-PAY-CORRELATION"',
  'add("PAY-INTENT-CORRELATION"',
  'add("SUBSCRIPTION-PAY-CORRELATION"',
  'add("DIG-PAY-CORRELATION"',
  'add("PAY-AMBIGUOUS-OUTCOMES"',
  'reconciliation.financial_journal_deployed_source_parity===true',
  'reconciliation.customer_registration_deployed_source_parity===true',
  'reconciliation.business_register_organization_scope_deployed_source_parity===true',
  'financial_journal_repository_source_sha256',
  'financial_journal_deployed_source_sha256',
  'financial_journal_parity_evidence_ref',
  'customer_registration_repository_source_sha256',
  'customer_registration_deployed_source_sha256',
  'customer_registration_parity_evidence_ref',
  'business_register_organization_scope_repository_source_sha256',
  'business_register_organization_scope_deployed_source_sha256',
  'business_register_organization_scope_parity_evidence_ref',
  'repositorySha.toLowerCase()===deployedSha.toLowerCase()',
  'EDGE-FINANCIAL-JOURNAL-PARITY',
  'EDGE-CUSTOMER-REGISTRATION-PARITY',
  'EDGE-BUSINESS-REGISTER-SCOPE-PARITY',
];

const home = read('web/home.js');
const requiredHomeMarkers = [
  'data-targeted-ad',
  "e.key==='Enter'||e.key===' '",
  'openMantiqatiAdModal(item)',
];
const missing = [
  ...requiredHomeMarkers.filter(x => !home.includes(x)).map(x => 'HOME:' + x),
  ...requiredTodoMarkers.filter(x => !todo.includes(x)).map(x => 'TODO:' + x),
  ...requiredContinuityMarkers.filter(x => !continuity.includes(x)).map(x => 'CONTINUITY:' + x),
  ...requiredWorkflowMarkers.filter(x => !workflow.includes(x)).map(x => 'WORKFLOW:' + x),
  ...requiredProductionGateMarkers.filter(x => !productionVerifier.includes(x)).map(x => 'PRODUCTION_GATE:' + x),
];

if (missing.length) {
  console.error('RC360 production gate contract: FAIL');
  for (const item of missing) console.error('MISSING:', item);
  process.exit(1);
}

console.log('RC360 production gate contract: PASS');
console.log('Release documentation still explicitly blocks certification until critical external/runtime gates are evidenced.');