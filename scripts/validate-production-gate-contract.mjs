#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const todo = read('docs/MASTER_PRODUCTION_TODO.md');
const continuity = read('docs/PROJECT_CONTINUITY.md');
const workflow = read('.github/workflows/pages.yml');
const productionVerifier = read('scripts/production/verify-production.mjs');
const reconciliation = JSON.parse(read('docs/release/production-migration-reconciliation.json'));
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
const requiredProductionGateMarkers = [
  'reconciliation.live_function_parity?.platform_admin_rpc_guards==="PASS"',
  'reconciliation.live_function_parity?.targeted_ads_search_path==="PASS"',
  'reconciliation.live_function_parity?.business_branch_admin==="PASS"',
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
const missing = [
  ...requiredHomeMarkers.filter(x => !home.includes(x)).map(x => 'HOME:' + x),
  ...requiredTodoMarkers.filter(x => !todo.includes(x)).map(x => 'TODO:' + x),
  ...requiredContinuityMarkers.filter(x => !continuity.includes(x)).map(x => 'CONTINUITY:' + x),
  ...requiredWorkflowMarkers.filter(x => !workflow.includes(x)).map(x => 'WORKFLOW:' + x),
  ...requiredProductionGateMarkers.filter(x => !productionVerifier.includes(x)).map(x => 'PRODUCTION_GATE:' + x),
  ...(['platform_admin_rpc_guards','targeted_ads_search_path','business_branch_admin'].filter(k => reconciliation.live_function_parity?.[k] !== 'FAIL').map(k => 'LIVE_PARITY: unresolved production drift must remain FAIL for ' + k)),
  ...(!productionVerifier.includes('!liveReconciliationVerified') ? ['PRODUCTION_GATE: live reconciliation must fail closed'] : []),
  ...(reconciliation.status !== 'BLOCKED' || reconciliation.verified !== false ? ['RECONCILIATION: live production must remain blocked until evidence is complete'] : []),
  ...(['platform_admin_rpc_guards','targeted_ads_search_path','business_branch_admin'].filter(k => reconciliation.live_function_parity?.[k] !== 'FAIL').map(k => 'RECONCILIATION: current live drift must remain explicitly failed for ' + k)),
];

if (missing.length) {
  console.error('RC360 production gate contract: FAIL');
  for (const item of missing) console.error('MISSING:', item);
  process.exit(1);
}

console.log('RC360 production gate contract: PASS');
console.log('Release documentation still explicitly blocks certification until critical external/runtime gates are evidenced.');