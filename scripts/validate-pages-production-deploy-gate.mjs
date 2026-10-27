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
assert.match(validateBlock, /Smoke test the live public catalog and Qadam storefront[\s\S]*?qadam-alsaad-homewares/,
  'Pages release must prove the actual Qadam storefront is visible through the live public directory');
assert.match(validateBlock, /npm run verify:production/,
  'Full platform production certification must still run and be reported');
assert.match(validateBlock, /FULL_PLATFORM_GATE=BLOCKED; CATALOG_PILOT_GATE=PASS/,
  'A blocked full platform gate may only be non-fatal for the independently verified catalog pilot');
assert.match(validateBlock, /if \[ "\$\{GATE\}" = "BLOCKED" \]/,
  'Only an explicit BLOCKED report may be non-fatal; unexpected verifier failures must stop release');
assert.match(validateBlock, /Compose existing platform root with catalog as a separate module/,
  'Pages artifact must preserve the existing platform root and mount catalog under a subpath');
assert.match(validateBlock, /rm -rf "\$\{SITE_DIR\}\/preview"/,
  'The production artifact must exclude the public demo preview tree');
assert.match(validateBlock, /rm -f "\$\{SITE_DIR\}\/smm\.html"/,
  'The production artifact must exclude the deferred SMM placeholder');
assert.match(validateBlock, /test ! -e "\$\{SITE_DIR\}\/preview"/,
  'The composed production site must not contain preview routes');
assert.match(validateBlock, /test ! -e "\$\{SITE_DIR\}\/smm\.html"/,
  'The composed production site must not contain the SMM placeholder');
assert.match(validateBlock, /cp -a web\/\.[\s\S]*?cp -a apps\/catalog-frontend\/dist\/\.[\s\S]*?catalog-app/,
  'Composition must combine the existing platform root with the catalog build');
assert.match(validateBlock, /path: \$\{\{ runner\.temp \}\}\/mantiqatix-composed-site/,
  'The composed site artifact must be uploaded from the runner temp directory');
assert.match(deployBlock, /needs: \[validate, validate_public_only\]/,
  'Deploy job must retain both validation dependencies so its condition can inspect their results');
assert.match(deployBlock, /if: always\(\).*needs\.validate\.result == 'success'/,
  'Deploy must evaluate after dependencies finish and require full validation to succeed');
assert.match(deployBlock, /name: mantiqatix-composed-pages-site[\s\S]*?path: \.\/site/,
  'Deploy must download and publish the composed site artifact');
assert.ok(deployBlock.includes('catalog-app/'), 'Post-deploy verification must check the catalog module subpath');
assert.ok(deployBlock.includes('MantiqatiX | منصة الخدمات ومقدميها'),
  'Post-deploy verification must ensure the original platform root is still present');
assert.doesNotMatch(deployBlock, /replacement catalog site|primary-catalog-frontend-dist/,
  'Deployment must not replace the platform root with the catalog-only frontend');
assert.doesNotMatch(deployBlock, /needs\.validate\.result == 'success'\s*\|\|\s*needs\.validate_public_only\.result == 'success'/,
  'Passing the narrow public-only check must not bypass failed production certification');

assert.doesNotMatch(primaryWorkflow, /actions\/deploy-pages@v4|pages:\s*write|id-token:\s*write/,
  'The catalog frontend validation workflow must not race the canonical Pages deploy workflow');
assert.doesNotMatch(previewWorkflow, /actions\/deploy-pages@v4|actions\/upload-pages-artifact@v4|pages:\s*write|id-token:\s*write/,
  'The deferred preview workflow must validate source only and never publish a Pages artifact');
assert.ok(primaryWorkflow.includes('/MantiqatiX/catalog-app/assets/'),
  'The catalog build must target its own subpath');
assert.ok(primaryWorkflow.includes('Upload catalog build for review (no deployment)'),
  'The primary catalog workflow must validate and upload an artifact without deploying');
assert.ok(home.includes('href="/MantiqatiX/catalog-app/">الكتالوج الإلكتروني</a>'),
  'The existing platform desktop navigation must link to the catalog module');
assert.ok(home.includes('href="/MantiqatiX/catalog-app/" data-mobile-nav>الكتالوج الإلكتروني</a>'),
  'The existing platform mobile navigation must link to the catalog module');
assert.doesNotMatch(home, /(?:href|src)=["'][^"']*preview\//,
  'The production homepage must not expose any demo preview routes');
assert.doesNotMatch(home, /(?:href|src)=["'][^"']*smm\.html/,
  'The deferred SMM placeholder must not be exposed as an active production navigation item');
assert.doesNotMatch(home, /معاينة تفاعلية|معاينة توضيحية/,
  'The production homepage must not present demo-tour copy as a live platform feature');
assert.ok(home.includes('افتح الكتالوج الإلكتروني'),
  'The homepage module section must route users to the real catalog module');
assert.ok(healthMonitor.includes('/MantiqatiX/catalog-app/assets/'),
  'Production health checks must monitor the catalog subpath');
assert.ok(healthMonitor.includes('MantiqatiX | منصة الخدمات ومقدميها'),
  'Production health checks must verify the existing platform root remains intact');
assert.match(deployBlock, /Retired production route still reachable:[\\s\\S]*?MANTIQATIX_DEMO_AND_SMM_ROUTES=NOT_PUBLISHED/,
  'Post-deploy verification must assert the demo preview and SMM routes are absent');
assert.doesNotMatch(healthMonitor, /grep -Fq "\/MantiqatiX\/assets\/" <<<"\$HTML"/,
  'Production health checks must not expect the React catalog app to replace the platform root');

console.log('PAGES_PRODUCTION_DEPLOY_GATE_AND_CATALOG_SUBPATH=PASS');
