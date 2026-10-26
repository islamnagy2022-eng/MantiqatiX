import fs from 'node:fs';
import assert from 'node:assert/strict';

const configSource = fs.readFileSync('web/demo/connected-config.js', 'utf8');
const url = configSource.match(/supabaseUrl:\s*["']([^"']+)["']/)?.[1];
const key = configSource.match(/supabaseKey:\s*["']([^"']+)["']/)?.[1];
assert.ok(url && key, 'connected DEMO must declare its isolated URL and publishable key');
assert.match(url, /^https:\/\/lkijdgqanbqjudiducjt\.supabase\.co$/, 'smoke test must target the isolated DEMO project');
assert.match(configSource, /environment:\s*["']DEMO["']/, 'connected config must explicitly declare DEMO');
assert.match(configSource, /paymentsEnabled:\s*false/, 'real payments must remain disabled');

const functions = [
  'demo-register-customer',
  'demo-business-create',
  'demo-catalog-write',
  'demo-order-create',
  'demo-order-status-update',
  'demo-appointment-create',
  'demo-membership-manage',
];
const allowedOrigin = 'https://islamnagy2022-eng.github.io';
const deniedOrigin = 'https://not-an-approved-origin.example';

async function preflight(slug, origin) {
  const response = await fetch(`${url}/functions/v1/${slug}`, {
    method: 'OPTIONS',
    headers: { apikey: key, Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,apikey,content-type' },
  });
  return response;
}

for (const slug of functions) {
  const allowed = await preflight(slug, allowedOrigin);
  assert.equal(allowed.status, 200, `${slug}: allowed origin should pass preflight (got ${allowed.status})`);
  assert.equal(allowed.headers.get('access-control-allow-origin'), allowedOrigin, `${slug}: allowed origin must be reflected`);

  const denied = await preflight(slug, deniedOrigin);
  assert.equal(denied.status, 403, `${slug}: unapproved origin should be rejected (got ${denied.status})`);

  // This is deliberately a non-mutating request: no Authorization header and no body.
  // verify_jwt=true must reject it before any handler logic runs.
  const unauthenticated = await fetch(`${url}/functions/v1/${slug}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json', Origin: allowedOrigin },
  });
  assert.equal(unauthenticated.status, 401, `${slug}: unauthenticated call must be rejected (got ${unauthenticated.status})`);
}

console.log(`Connected DEMO live smoke: PASS (${functions.length} functions; allowed/denied CORS; unauthenticated POST blocked; no data mutations).`);
