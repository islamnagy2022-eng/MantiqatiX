#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const primaryWorkflow = fs.readFileSync('.github/workflows/primary-catalog-frontend.yml', 'utf8');
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

assert.match(validateBlock, /- name: Production verification engine[\s\S]*?run: npm run verify:production/,
  'Full validation job must run the production certification verifier');
assert.match(validateBlock, /Compose existing platform root with catalog as a separate module/,
  'Pages artifact must preserve the existing platform root and mount catalog under a subpath');
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
assert.ok(primaryWorkflow.includes('/MantiqatiX/catalog-app/assets/'),
  'The catalog build must target its own subpath');
assert.ok(primaryWorkflow.includes('Upload catalog build for review (no deployment)'),
  'The primary catalog workflow must validate and upload an artifact without deploying');

console.log('PAGES_PRODUCTION_DEPLOY_GATE_AND_CATALOG_SUBPATH=PASS');
