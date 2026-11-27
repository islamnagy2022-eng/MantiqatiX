import fs from 'node:fs';
import assert from 'node:assert/strict';

const frontend = fs.readFileSync('apps/catalog-frontend/src/lib/businessCreationValidation.ts', 'utf8');
const frontendTest = fs.readFileSync('apps/catalog-frontend/tests/business-creation-validation.test.ts', 'utf8');
const backend = fs.readFileSync('supabase/functions/catalog-platform-admin/index.ts', 'utf8');

assert.match(frontend, /Array\.from\(name\)\.length\s*<\s*2/,
  'Frontend must count Unicode code points, not UTF-16 code units.');
assert.match(frontendTest, /name:\s*'😀'/,
  'Frontend unit test must cover a single supplementary Unicode character.');
assert.match(backend, /Array\.from\(name\)\.length\s*<\s*2/,
  'Backend must enforce the same Unicode code-point minimum.');
assert.match(backend, /governorate\.length\s*<\s*2[\s\S]*?markaz\.length\s*<\s*2[\s\S]*?INVALID_BUSINESS_LOCATION/,
  'CREATE_BUSINESS must reject missing/too-short governorate and markaz values.');
assert.match(backend, /const governorate\s*=\s*String\(input\.governorate\s*\|\|\s*""\)\.trim\(\)/,
  'Backend must validate the normalized governorate value.');
assert.match(backend, /const markaz\s*=\s*String\(input\.markaz\s*\|\|\s*""\)\.trim\(\)/,
  'Backend must validate the normalized markaz value.');

console.log('CATALOG_BUSINESS_IDENTITY_FRONTEND_BACKEND_PARITY=PASS');
