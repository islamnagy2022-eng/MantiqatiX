import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(root, 'docs/audits/R7_API_ROUTE_POLICY_INVENTORY_20261119.md');
const report = await readFile(reportPath, 'utf8');
const fail = (message) => { console.error('R7_ROUTE_POLICY_INVENTORY_INVALID: ' + message); process.exitCode = 1; };
const policies = new Set(['PUBLIC_INGRESS','AUTHENTICATED_USER','TENANT_MEMBER','BUSINESS_BRANCH_SCOPED','PLATFORM_ADMIN','SERVICE_TO_SERVICE','DISABLED']);
const archiveSha = '210da1638eb9b1f02c9db9d27ff5ef14d22bd497fec8b2fc8d9ada0f98df2d8b';
if (!report.includes('Archive SHA-256:** `' + archiveSha + '`')) fail('source archive SHA-256 mismatch');
if (!report.includes('113 distinct `/api/*` route declarations')) fail('source route count marker missing');
if (!report.includes('54 of the 73 mutating handlers')) fail('static scan finding count marker missing');
if (!report.includes('R7 remains **BLOCKED / NOT DEPLOYABLE**')) fail('R7 release block missing');

const rowPattern = /^\| (\d+) \| \x60(GET|POST|PUT|PATCH|DELETE)\x60 \| \x60(\/api\/[^\x60]+)\x60 \| \x60([A-Z_]+)\x60 \|$/gm;
const rows = [...report.matchAll(rowPattern)].map((match) => ({ line: Number(match[1]), method: match[2], route: match[3], policy: match[4] }));
if (rows.length !== 113) fail('expected 113 route rows, found ' + rows.length);
const seen = new Set();
const counts = Object.create(null);
let mutating = 0;
for (const row of rows) {
  const key = row.method + ' ' + row.route;
  if (seen.has(key)) fail('duplicate route: ' + key);
  seen.add(key);
  if (!policies.has(row.policy)) fail('unapproved policy on ' + key + ': ' + row.policy);
  if (!Number.isInteger(row.line) || row.line < 1) fail('invalid source line on ' + key);
  counts[row.policy] = (counts[row.policy] || 0) + 1;
  if (['POST','PUT','PATCH','DELETE'].includes(row.method)) {
    mutating += 1;
    if (row.policy === 'PUBLIC_INGRESS') {
      const allowlisted = new Set(['/api/auth/login','/api/auth/register','/api/auth/verify-email','/api/auth/recover','/api/auth/refresh','/api/contact','/api/messages','/api/meta-pixel/events','/api/crm/leads']);
      if (!allowlisted.has(row.route)) fail('mutating PUBLIC_INGRESS route is not explicitly allowlisted: ' + key);
    }
  }
}
if (mutating !== 73) fail('expected 73 mutating routes, found ' + mutating);
for (const policy of policies) {
  const escaped = policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const countMatch = report.match(new RegExp('^\\| `' + escaped + '` \\| (\\d+) \\|$', 'm'));
  if (Number(countMatch?.[1] ?? -1) !== (counts[policy] || 0)) fail('policy count summary mismatch for ' + policy);
}
const disabledRequired = [
  'GET /api/production-state','POST /api/production-state','POST /api/production/commit-all',
  'POST /api/auth/session-token','GET /api/wallets','POST /api/wallets/transaction',
  'POST /api/merchant-hub/ledger','POST /api/security/evaluate-rls',
  'POST /api/finance/audited-transaction','POST /api/production/backups/verify-restore',
  'POST /api/production/rollback'
];
for (const key of disabledRequired) {
  const [method, route] = key.split(' ');
  if (!rows.some((row) => row.method === method && row.route === route && row.policy === 'DISABLED')) fail('critical route must remain DISABLED: ' + key);
}
if (process.exitCode) process.exit();
console.log('R7_ROUTE_POLICY_INVENTORY_PASS: 113 routes; 73 mutating; 7 policy classes; all R7 routes remain blocked from release.');
