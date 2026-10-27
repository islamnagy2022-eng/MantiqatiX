#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const primaryWorkflow = fs.readFileSync('.github/workflows/primary-catalog-frontend.yml', 'utf8');
const home = fs.readFileSync('web/home.js', 'utf8');
const platformApp = fs.readFileSync('web/app.js', 'utf8');
const healthMonitor = fs.readFileSync('.github/workflows/production-health-monitor.yml', 'utf8');
const lines = workflow.split(/\r?\n/);
const blockStart = lines.findIndex(line => line === '  deploy:');
assert.notEqual(blockStart, -1, 'Pages workflow must define deploy job');
const blockEnd = lines.findIndex((line, index) => index > blockStart && /^  [A-Za-z0-9_-]+:$/.test(line));
const deployBlock = lines.slice(blockStart, blockEnd < 0 ? lines.length : blockEnd).join('\n');

const validateStart = lines.findIndex(line => line === '  validate:');
const publicOnlyStart = lines.findIndex(line => line === '  validate_public_only:');
assert.notEqual(validateStart, -1, 'Pages workflow must define full validate job');
assert.notEqual(publicOnlyStart, -1, 'Pages workflow must define the narrow public-only validator');
const validateBlock = lines.slice(validateStart, publicOnlyStart).join('\n');

assert.match(validateBlock, /Verify scoped catalog pilot release prerequisites[\s\S]*?node scripts\/production\/verify-catalog-pilot\.mjs/,
  'Pages release must pass the catalog-specific production gate');
assert.match(validateBlock, /Smoke test the live public catalog and Qadam storefront[\s\S]*?qadam-alsaad-homewares/,
  'Pages release must prove the actual Qadam storefront is visible through the live public directory');
assert.match(validateBlock, /npm run verify:production/,
  'Full platform production certification must still run and be reported');
assert.match(validateBlock, /FULL_PLATFORM_GATE=BLOCKED; CATALOG_PILOT_GATE=PASS/,
  'A blocked full platform gate may only be non-fatal for the independently verified catalog pilot');
assert.match(validateBlock, /if \[ "\$\{GATE\}" = "BLOCKED" \]/,
  'Only an explicit BLOCKED report may be non-fatal; unexpected verifier failures must stop release');
assert.match(validateBlock, /Compose catalog as the primary MantiqatiX site/,
  'Pages artifact must publish the electronic catalog as the primary site root');
assert.match(validateBlock, /cp -a apps\/catalog-frontend\/dist\/\.[\s\S]*?mantiqatix-primary-catalog-site/,
  'Composition must publish the catalog build directly at the site root');
assert.ok(validateBlock.includes('test ! -e "${SITE_DIR}/home.js"') && validateBlock.includes('test ! -e "${SITE_DIR}/app.js"'),
  'Legacy platform UI must not be published at the primary site root');
assert.match(validateBlock, /path: \$\{\{ runner\.temp \}\}\/mantiqatix-primary-catalog-site/,
  'The primary catalog artifact must be uploaded from the runner temp directory');
assert.ok(validateBlock.includes('cp -a apps/catalog-frontend/dist/. "${SITE_DIR}/"'),
  'The production root must be copied from the catalog build, not the legacy web folder');
assert.ok(validateBlock.includes('grep -Fq \'/MantiqatiX/assets/\' "${SITE_DIR}/index.html"'),
  'The published catalog must reference root-level production assets');
assert.match(deployBlock, /needs: \[validate, validate_public_only\]/,
  'Deploy job must retain both validation dependencies so its condition can inspect their results');
assert.match(deployBlock, /if: always\(\).*needs\.validate\.result == 'success'/,
  'Deploy must evaluate after dependencies finish and require full validation to succeed');
assert.match(deployBlock, /name: mantiqatix-primary-catalog-site[\s\S]*?path: \.\/site/,
  'Deploy must download and publish the primary catalog artifact');
assert.ok(deployBlock.includes('MANTIQATIX_PRIMARY_CATALOG_DEPLOY=PASS'), 'Post-deploy verification must confirm the primary catalog release');
assert.doesNotMatch(deployBlock, /catalog-app\/|home\.js/, 'Deployment must not publish the legacy UI or a nested catalog route');
assert.doesNotMatch(deployBlock, /needs\.validate\.result == 'success'\s*\|\|\s*needs\.validate_public_only\.result == 'success'/,
  'Passing the narrow public-only check must not bypass failed production certification');

assert.doesNotMatch(primaryWorkflow, /actions\/deploy-pages@v4|pages:\s*write|id-token:\s*write/,
  'The catalog frontend validation workflow must not race the canonical Pages deploy workflow');
assert.ok(primaryWorkflow.includes('/MantiqatiX/assets/'),
  'The catalog build must target root-level assets');
assert.ok(primaryWorkflow.includes('Upload catalog build for review (no deployment)'),
  'The primary catalog workflow must validate and upload an artifact without deploying');
assert.ok(!workflow.includes('cp -a web/. "${SITE_DIR}/"'),
  'The legacy homepage must not be the deployed root');
assert.doesNotMatch(home, /preview\/|mx-public-module-hub|mx-module-hub|smm\.html/,
  'The public homepage must not expose demo routes or the deferred SMM page');
assert.doesNotMatch(platformApp, /href="smm\.html"|smmModulePage|خدمات التسويق الرقمي SMM/,
  'The app workspace must not expose a deferred SMM route');
assert.ok(healthMonitor.includes('/MantiqatiX/assets/'),
  'Production health checks must monitor the primary catalog assets');
assert.ok(!healthMonitor.includes('/MantiqatiX/catalog-app/'),
  'Production health checks must not rely on a nested catalog path');

console.log('PAGES_PRODUCTION_DEPLOY_GATE_AND_CATALOG_SUBPATH=PASS');
