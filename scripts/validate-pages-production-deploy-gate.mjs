#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
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
assert.match(deployBlock, /needs: \[validate, validate_public_only\]/,
  'Deploy job must retain both validation dependencies so its condition can inspect their results');
assert.match(deployBlock, /if: always\(\).*needs\.validate\.result == 'success'/,
  'Deploy must evaluate after dependencies finish and require full validation to succeed');
assert.doesNotMatch(deployBlock, /needs\.validate\.result == 'success'\s*\|\|\s*needs\.validate_public_only\.result == 'success'/,
  'Passing the narrow public-only check must not bypass failed production certification');

console.log('PAGES_PRODUCTION_DEPLOY_GATE=PASS');
