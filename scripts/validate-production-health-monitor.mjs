import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync('.github/workflows/production-health-monitor.yml', 'utf8');
const missingTokenStart = workflow.indexOf('if [[ -z "${HEALTH_MONITOR_TOKEN:-}" ]]');
assert.ok(missingTokenStart >= 0, 'The health workflow must guard a missing monitor token.');
const missingTokenEnd = workflow.indexOf('\n          fi', missingTokenStart);
assert.ok(missingTokenEnd > missingTokenStart, 'The missing-token branch must be a complete shell conditional.');
const missingTokenBranch = workflow.slice(missingTokenStart, missingTokenEnd);
assert.ok(missingTokenBranch.includes('health_function_mode=not_checked'), 'A missing token must mark the Edge health function as not checked.');
assert.ok(missingTokenBranch.includes('database_probe_mode=legacy_anon'), 'A missing token must retain the read-only anon database fallback.');
assert.ok(missingTokenBranch.includes('::warning::'), 'A missing token must emit a GitHub Actions warning.');
assert.ok(!missingTokenBranch.includes('health_function_mode=checked'), 'A missing token must never mark the protected health function as checked.');

const statusCheck = workflow.indexOf('grep -Fq \'"status":"ok"\' <<<"$BODY"');
const serviceCheck = workflow.indexOf('grep -Fq \'"service":"mantiqatix-health"\' <<<"$BODY"');
const checkedOutput = workflow.indexOf('health_function_mode=checked');
assert.ok(statusCheck >= 0 && serviceCheck > statusCheck && checkedOutput > serviceCheck,
  'The Edge health function may be marked checked only after both response assertions pass.');

const summaryStart = workflow.indexOf('- name: Health summary');
assert.ok(summaryStart >= 0, 'The workflow must expose a health summary.');
const summary = workflow.slice(summaryStart);
assert.ok(summary.includes('HEALTH_FUNCTION_MODE: ${{ steps.supabase_health.outputs.health_function_mode }}'));
assert.ok(summary.includes('DATABASE_PROBE_MODE: ${{ steps.supabase_health.outputs.database_probe_mode }}'));
assert.ok(summary.includes('Edge Function /health: NOT CHECKED (HEALTH_MONITOR_TOKEN missing)'));
assert.ok(summary.includes('Database read probe: PASS (legacy anon fallback, read-only)'));
assert.ok(summary.includes('Edge Function /health: PASS'));
assert.ok(!workflow.includes('Edge Function /health: runtime and database contract checked'),
  'The old unconditional success claim must not return.');

console.log('PRODUCTION_HEALTH_MONITOR_REPORTING=PASS');
