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
  '20261011010000_rc456_smm_service_role_access_boundary.sql',
  '20261019060000_rc454_marketing_partner_allocation_integrity.sql',
  '20261019070000_rc455_marketing_campaign_terminal_guard.sql',
  '20261019080000_rc456_marketing_partner_closure_backend.sql',
  '20261019090000_rc457_public_marketing_service_catalog.sql',
  '20261019100000_rc458_public_provider_profile_column_allowlist.sql',
  '20261019110000_rc459_profile_media_policy_regex_fix.sql',
];
const releaseMigrationPositions = requiredReleaseMigrationMarkers.map(name => productionGate.indexOf(name));
if (releaseMigrationPositions.some(position => position < 0)) {
  console.error('RC360 production gate contract: FAIL');
  for (const name of requiredReleaseMigrationMarkers.filter(name => !productionGate.includes(name))) {
    console.error('MISSING RELEASE MIGRATION:', name);
  }
  process.exit(1);
}
if (releaseMigrationPositions.some((position, index) => index > 0 && position <= releaseMigrationPositions[index - 1])) {
  console.error('RC360 production gate contract: FAIL');
  console.error('Required release migrations are not in chronological order.');
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