#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const primaryWorkflow = fs.readFileSync('.github/workflows/primary-catalog-frontend.yml', 'utf8');
const healthMonitor = fs.readFileSync('.github/workflows/production-health-monitor.yml', 'utf8');
const previewWorkflow = fs.readFileSync('.github/workflows/preview-pages.yml', 'utf8');

const lines = workflow.split(/\r?\n/);
const deployStart = lines.findIndex(line => line === '  deploy:');
assert.notEqual(deployStart, -1, 'Pages workflow must define the canonical deploy job');
const deployEnd = lines.findIndex((line, index) => index > deployStart && /^  [A-Za-z0-9_-]+:$/.test(line));
const deploy = lines.slice(deployStart, deployEnd < 0 ? lines.length : deployEnd).join('\n');
const validateStart = lines.findIndex(line => line === '  validate:');
const publicOnlyStart = lines.findIndex(line => line === '  validate_public_only:');
assert.notEqual(validateStart, -1);
assert.notEqual(publicOnlyStart, -1);
const validate = lines.slice(validateStart, publicOnlyStart).join('\n');

assert.match(validate, /npm run lint[\s\S]*?npm run build[\s\S]*?grep -q '\/MantiqatiX\/assets\/' dist\/index\.html/,
  'The catalog must build with assets rooted at the single production site path');
assert.match(validate, /Verify scoped catalog pilot release prerequisites[\s\S]*?verify-catalog-pilot\.mjs/,
  'The scoped production catalog gate must pass before deployment');
assert.match(validate, /Smoke test the live public catalog and Qadam storefront[\s\S]*?qadam-alsaad-homewares/,
  'The actual public catalog and Qadam storefront must be verified');
assert.match(validate, /npm run verify:production[\s\S]*?FULL_PLATFORM_GATE=BLOCKED; CATALOG_PILOT_GATE=PASS/,
  'A blocked full platform gate may only permit the independently verified catalog release');

assert.match(validate, /Prepare the catalog as the only production website/,
  'The deployment artifact must be assembled from the React catalog only');
assert.match(validate, /cp -a apps\/catalog-frontend\/dist\/\. "\$\{SITE_DIR\}\/"/,
  'The catalog build must be copied to the site root');
assert.doesNotMatch(validate, /cp -a web\/\./,
  'The old web shell must never be copied into the production artifact');
assert.match(validate, /! grep -Fq 'home\.js'/,
  'The production artifact must not include the old homepage entrypoint');
assert.match(validate, /name: mantiqatix-primary-catalog-site[\s\S]*?path: \$\{\{ runner\.temp \}\}\/mantiqatix-primary-catalog-site/,
  'The uploaded artifact must be the catalog-only root site');

assert.match(deploy, /name: mantiqatix-primary-catalog-site[\s\S]*?path: \.\/site/,
  'The deploy job must publish the catalog-only artifact');
assert.match(deploy, /grep -Fq "\/MantiqatiX\/assets\/"[\s\S]*?! grep -Fq "home\.js"/,
  'Post-deploy verification must prove the catalog is at root and old homepage is absent');
assert.match(deploy, /Retired production route still reachable:[\s\S]*?LEGACY_PLATFORM_AND_DEMO_ROUTES=NOT_PUBLISHED/,
  'Old demo/SMM/catalog-app paths must not be part of the production site');

assert.doesNotMatch(primaryWorkflow, /actions\/deploy-pages@v4|pages:\s*write|id-token:\s*write/,
  'The secondary catalog validation workflow must not deploy independently');
assert.match(primaryWorkflow, /\/MantiqatiX\/assets\//,
  'The secondary catalog workflow must validate root-based asset paths');
assert.match(primaryWorkflow, /Upload catalog build for review \(no deployment\)/,
  'The secondary catalog workflow must remain validation-only');
assert.doesNotMatch(previewWorkflow, /actions\/deploy-pages@v4|actions\/upload-pages-artifact@v4|pages:\s*write|id-token:\s*write/,
  'The deferred preview workflow must never publish a site');
assert.match(healthMonitor, /Check catalog-only production root and assets[\s\S]*?\/MantiqatiX\/assets\//,
  'Production monitoring must verify the catalog-only root');
assert.doesNotMatch(healthMonitor, /MantiqatiX \| منصة الخدمات ومقدميها|catalog-app\/assets/,
  'Production monitoring must not expect the old site or a secondary catalog path');

console.log('PAGES_PRODUCTION_DEPLOY_GATE_AND_CATALOG_ONLY_ROOT=PASS');
