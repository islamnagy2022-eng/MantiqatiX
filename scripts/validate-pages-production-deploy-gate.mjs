#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const primaryWorkflow = fs.readFileSync('.github/workflows/primary-catalog-frontend.yml', 'utf8');
const home = fs.readFileSync('web/home.js', 'utf8');
const healthMonitor = fs.readFileSync('.github/workflows/production-health-monitor.yml', 'utf8');
const previewWorkflow = fs.readFileSync('.github/workflows/preview-pages.yml', 'utf8');
const lines = workflow.split(/\r?\n/);
const blockStart = lines.findIndex(line => line === '  deploy:');
assert.notEqual(blockStart, -1, 'Pages workflow must define deploy job');
assert.match(workflow, /group: pages-\$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}/,
  'PR validation must use a separate Pages concurrency group and never cancel the main deployment');
const blockEnd = lines.findIndex((line, index) => index > blockStart && /^  [A-Za-z0-9_-]+:$/.test(line));
const deployBlock = lines.slice(blockStart, blockEnd < 0 ? lines.length : blockEnd).join('\n');

const validateStart = lines.findIndex(line => line === '  validate:');
const publicOnlyStart = lines.findIndex(line => line === '  validate_public_only:');
assert.notEqual(validateStart, -1, 'Pages workflow must define full validate job');
assert.notEqual(publicOnlyStart, -1, 'Pages workflow must define the narrow public-only validator');
const validateBlock = lines.slice(validateStart, publicOnlyStart).join('\n');
const publicOnlyBlock = lines.slice(publicOnlyStart, blockStart).join('\n');
assert.match(publicOnlyBlock, /id: path_gate[\s\S]*?PUBLIC_ONLY_GATE=NOT_APPLICABLE/,
  'Non-public pushes must skip the narrow public-only lane instead of failing a valid full release');
assert.match(publicOnlyBlock, /eligible=false[\s\S]*?canonical full validation and deploy gate remain authoritative/,
  'The public-only lane must remain non-authoritative when backend/workflow files change');
assert.ok((publicOnlyBlock.match(/if: steps\.path_gate\.outputs\.eligible == 'true'/g) || []).length >= 3,
  'Setup and validation steps must be skipped when the change is not public-shell-only');
assert.doesNotMatch(publicOnlyBlock, /Refusing public-only deployment because this path is outside the allowlist/,
  'Non-public file changes must not fail the auxiliary public-only job when the canonical release gate validates them');

assert.match(validateBlock, /Verify scoped catalog pilot release prerequisites[\s\S]*?node scripts\/production\/verify-catalog-pilot\.mjs/,
  'Pages release must pass the catalog-specific production gate');
assert.match(validateBlock, /Validate professional dashboard production dependency gate semantics[\s\S]*?node scripts\/validate-professional-dashboard-production-dependencies\.mjs/,
  'The dashboard release guard behavior must be tested in pull-request CI');
assert.match(validateBlock, /Gate production deployment on live professional dashboard dependencies[\s\S]*?node scripts\/production\/verify-professional-dashboard-dependencies\.mjs/,
  'Main deployment must be blocked until the dashboard database dependencies are live and verified');
assert.match(validateBlock, /Smoke test the live public catalog and Qadam storefront[\s\S]*?qadam-alsaad-homewares/,
  'Pages release must prove the actual Qadam storefront is visible through the live public directory');
assert.match(validateBlock, /npm run verify:production/,
  'Full platform production certification must still run and be reported');
assert.match(validateBlock, /FULL_PLATFORM_GATE=BLOCKED; CATALOG_PILOT_GATE=PASS/,
  'A blocked full platform gate may only be non-fatal for the independently verified catalog pilot');
assert.match(validateBlock, /if \[ "\$\{GATE\}" = "BLOCKED" \]/,
  'Only an explicit BLOCKED report may be non-fatal; unexpected verifier failures must stop release');
assert.match(validateBlock, /Publish V6 as the production root and preserve the previous catalog/,
  'Pages artifact must publish the reviewed public V6 app at root and retain the prior catalog');
assert.match(validateBlock, /VITE_BASE_PATH=\/MantiqatiX\/legacy\/ npm run build/,
  'The previous catalog must be rebuilt for its retained legacy subpath');
assert.match(validateBlock, /VITE_BASE_PATH=\/MantiqatiX\/ bun run build/,
  'The public V6 app must have a root-based production build');
assert.match(validateBlock, /cp -a "\$\{V6_ROOT_DIST\}\/\." "\$\{SITE_DIR\}\/"/,
  'The V6 root build must be the production index');
assert.match(validateBlock, /cp -a apps\/catalog-frontend\/dist\/\. "\$\{SITE_DIR\}\/legacy\//,
  'The previous catalog must remain available under the legacy subpath');
assert.match(validateBlock, /test ! -e "\$\{SITE_DIR\}\/preview"/,
  'The composed production site must not contain preview routes');
assert.match(validateBlock, /test ! -e "\$\{SITE_DIR\}\/smm\.html"/,
  'The composed production site must not contain the SMM placeholder');
assert.match(validateBlock, /test -s "\$\{SITE_DIR\}\/legacy\/index\.html"/,
  'The retained legacy site must contain its original entry point');
assert.match(validateBlock, /test -s "\$\{SITE_DIR\}\/v6-preview\/index\.html"/,
  'The V6 preview alias must be retained alongside the production root');
assert.doesNotMatch(validateBlock, /cp -a web\//,
  'Legacy web application must not be included in the production artifact');
assert.match(validateBlock, /path: \$\{\{ runner\.temp \}\}\/mantiqatix-composed-site/,
  'The composed site artifact must be uploaded from the runner temp directory');
assert.match(deployBlock, /needs: \[validate, validate_public_only\]/,
  'Deploy job must retain both validation dependencies so its condition can inspect their results');
assert.match(deployBlock, /if: always\(\).*needs\.validate\.result == 'success'/,
  'Deploy must evaluate after dependencies finish and require full validation to succeed');
assert.match(deployBlock, /name: mantiqatix-composed-pages-site[\s\S]*?path: \.\/site/,
  'Deploy must download and publish the composed site artifact');
assert.ok(deployBlock.includes('/MantiqatiX/assets/'), 'Post-deploy verification must check V6 root assets');
assert.ok(deployBlock.includes('MANTIQATIX_V6_PRIMARY_ROOT_DEPLOY=PASS'),
  'Post-deploy verification must confirm V6 is the public root');
assert.ok(deployBlock.includes('MANTIQATIX_LEGACY_CATALOG_DEPLOY=PASS'),
  'Post-deploy verification must confirm the former catalog remains available under /legacy/');
assert.ok(deployBlock.includes('MANTIQATIX_V6_PREVIEW_ALIAS_DEPLOY=PASS'),
  'Post-deploy verification must keep the V6 preview alias reachable');
assert.ok(deployBlock.includes('scripts/test-v6-deployed-root.mjs'),
  'Deployed V6 root must receive browser coverage including legacy businessId QR links');
assert.ok(deployBlock.includes('MANTIQUATIX_E2E_BASE_URL="${LEGACY_URL}"'),
  'Existing dashboard, mobile and QR E2E must run against the retained legacy catalog');
assert.doesNotMatch(deployBlock, /catalog-app\//,
  'Production deployment must not depend on a catalog subpath');
assert.doesNotMatch(deployBlock, /needs\.validate\.result == 'success'\s*\|\|\s*needs\.validate_public_only\.result == 'success'/,
  'Passing the narrow public-only check must not bypass failed production certification');

assert.doesNotMatch(primaryWorkflow, /actions\/deploy-pages@v4|pages:\s*write|id-token:\s*write/,
  'The catalog frontend validation workflow must not race the canonical Pages deploy workflow');
assert.doesNotMatch(previewWorkflow, /actions\/deploy-pages@v4|actions\/upload-pages-artifact@v4|pages:\s*write|id-token:\s*write/,
  'The deferred preview workflow must validate source only and never publish a Pages artifact');
assert.ok(primaryWorkflow.includes('/MantiqatiX/assets/'),
  'The catalog build must target the public root');
assert.ok(primaryWorkflow.includes('Upload catalog build for review (no deployment)'),
  'The primary catalog workflow must validate and upload an artifact without deploying');
assert.ok(home.includes('href="/MantiqatiX/catalog-app/">الكتالوج الإلكتروني</a>'),
  'Legacy source navigation may continue linking to the catalog during development');
assert.ok(home.includes('href="/MantiqatiX/catalog-app/" data-mobile-nav>الكتالوج الإلكتروني</a>'),
  'Legacy source navigation must retain its catalog entry for compatibility');
assert.doesNotMatch(home, /(?:href|src)=["'][^"']*preview\//,
  'The production homepage must not expose any demo preview routes');
assert.doesNotMatch(home, /(?:href|src)=["'][^"']*smm\.html/,
  'The deferred SMM placeholder must not be exposed as an active production navigation item');
assert.doesNotMatch(home, /معاينة تفاعلية|معاينة توضيحية/,
  'The production homepage must not present demo-tour copy as a live platform feature');
assert.ok(home.includes('افتح الكتالوج الإلكتروني'),
  'The homepage module section must route users to the real catalog module');
assert.ok(healthMonitor.includes('/MantiqatiX/assets/'),
  'Production health checks must monitor V6 root assets');
assert.ok(healthMonitor.includes('/MantiqatiX/legacy/assets/'),
  'Production health checks must monitor the retained legacy catalog assets');
assert.ok(healthMonitor.includes('V6_PRODUCTION_ROOT_AND_LEGACY_ASSETS=PASS'),
  'Production health checks must verify the V6 root and legacy rollback path');
assert.match(deployBlock, /Retired production route still reachable:[\s\S]*?MANTIQATIX_DEMO_AND_SMM_ROUTES=NOT_PUBLISHED/,
  'Post-deploy verification must assert the demo preview and SMM routes are absent');
assert.ok(healthMonitor.includes('V6_PRODUCTION_ROOT_AND_LEGACY_ASSETS=PASS'),
  'Production health checks must verify V6 at the root and the retained legacy catalog');

console.log('PAGES_PRODUCTION_DEPLOY_GATE_V6_ROOT_LEGACY_ROLLBACK=PASS');
