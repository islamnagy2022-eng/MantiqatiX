import assert from 'node:assert/strict';
import fs from 'node:fs';

const frontendRoot = 'apps/catalog-frontend';
const runtime = fs.readFileSync(`${frontendRoot}/src/lib/production.ts`, 'utf8');
const envExample = fs.readFileSync(`${frontendRoot}/.env.example`, 'utf8');
const gitignore = fs.readFileSync(`${frontendRoot}/.gitignore`, 'utf8');
const productionConfig = fs.readFileSync(`${frontendRoot}/public/config.js`, 'utf8');
const packageJson = JSON.parse(fs.readFileSync(`${frontendRoot}/package.json`, 'utf8'));

const demoUrl = 'https://lkijdgqanbqjudiducjt.supabase.co';
const productionUrl = 'https://moyhiluyhjsujhwlyeuu.supabase.co';

assert.match(runtime, /import\.meta\.env\.DEV\s*===\s*true/, 'DEMO override must be restricted to Vite development mode');
assert.ok(runtime.includes(`const DEVELOPMENT_SUPABASE_URL = '${demoUrl}'`), 'DEMO URL must be pinned to the isolated project');
assert.match(runtime, /VITE_SUPABASE_URL/, 'DEMO URL must be configured through a local Vite environment variable');
assert.match(runtime, /VITE_SUPABASE_PUBLISHABLE_KEY/, 'DEMO must use a public publishable key');
assert.match(runtime, /\^sb_publishable_\[A-Za-z0-9_-\]\+\$/, 'DEMO must reject non-publishable or privileged keys');
assert.match(runtime, /mantiqatix\.demo\.auth/, 'DEMO auth sessions must use separate browser storage');
assert.match(runtime, /mantiqatix\.production\.auth/, 'Production auth storage key must remain unchanged');

const devBlockStart = runtime.indexOf('if (isViteDevelopment) {');
const productionBlockStart = runtime.indexOf('const browserRuntime =', devBlockStart);
assert.ok(devBlockStart >= 0 && productionBlockStart > devBlockStart, 'DEMO block must precede the Production fallback');
const devBlock = runtime.slice(devBlockStart, productionBlockStart);
assert.ok(!devBlock.includes('moyhiluyhjsujhwlyeuu'), 'DEMO block must not mention the Production project');
assert.ok(!devBlock.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Browser DEMO configuration must not contain service-role credentials');
assert.ok(devBlock.includes('بيئة التطوير يجب أن تستخدم مشروع MantiqatiX-DEMO فقط'), 'Invalid or missing DEMO configuration must fail closed');

assert.ok(envExample.includes(demoUrl), '.env.example must point to DEMO');
assert.ok(envExample.includes('sb_publishable_REPLACE_WITH_DEMO_PROJECT_KEY'), '.env.example must use a placeholder, not a real key');
assert.ok(!/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(envExample), '.env.example must not embed a real JWT');
assert.ok(gitignore.split(/\r?\n/).includes('.env.*'), 'Local environment files must be ignored');
assert.ok(gitignore.split(/\r?\n/).includes('!.env.example'), 'Only the safe example environment file may be committed');
assert.ok(productionConfig.includes(productionUrl), 'Published static config must continue targeting Production');
assert.ok(!productionConfig.includes(demoUrl), 'Published static config must never target DEMO');
assert.equal(packageJson.scripts?.['dev:demo'], 'vite --port=8080 --host=0.0.0.0', 'DEMO local server must use the CORS-allowlisted port 8080');

console.log('Free DEMO Supabase runtime isolation: PASS (local Vite only, fail-closed, separate auth storage, production config unchanged).');
