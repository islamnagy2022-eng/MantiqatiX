import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'docs/release/production-migration-reconciliation.json'), 'utf8'));
const evidence = manifest.professional_dashboard_dependency_check;
const verifyScript = path.join(root, 'scripts/production/verify-professional-dashboard-dependencies.mjs');
assert.ok(evidence && Array.isArray(evidence.required_objects), 'live dashboard dependency evidence must be explicit');
assert.ok(evidence.required_objects.length >= 9, 'all required dashboard control-center and employee RPC objects must be tracked');
assert.ok(readFileSync(verifyScript, 'utf8').includes("process.env.GITHUB_REF === 'refs/heads/main'"), 'main deploy must be treated differently from feature validation');

const run = (eventName, ref) => spawnSync(process.execPath, [verifyScript], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_REF: ref },
});

const pullRequest = run('pull_request', 'refs/pull/483/merge');
assert.equal(pullRequest.status, 0, pullRequest.stderr || pullRequest.stdout);
assert.match(pullRequest.stdout, /PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=(BLOCKED|PASS)/);

const featurePush = run('push', 'refs/heads/feat/professional-dashboard-additive-20261028');
assert.equal(featurePush.status, 0, featurePush.stderr || featurePush.stdout);
assert.match(featurePush.stdout, /PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=(BLOCKED|PASS)/);

const mainPush = run('push', 'refs/heads/main');
const evidenceReady = evidence.status === 'PASS' &&
  evidence.required_objects.every((entry) => entry?.exists === true && entry?.status === 'PASS');
assert.equal(mainPush.status === 0, evidenceReady, mainPush.stderr || mainPush.stdout);
if (!evidenceReady) {
  assert.match(mainPush.stdout + mainPush.stderr, /Refusing main deployment|PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCIES=BLOCKED/);
}

console.log('PROFESSIONAL_DASHBOARD_PRODUCTION_DEPENDENCY_GATE=PASS');
console.log('Verified: PR/feature CI stays usable; main deployment is blocked while live database objects are unverified or absent.');
