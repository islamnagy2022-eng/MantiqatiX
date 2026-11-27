#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const directory = read('apps/catalog-frontend/src/components/DirectoryView.tsx');
const app = read('apps/catalog-frontend/src/App.tsx');
const seo = read('apps/catalog-frontend/src/utils/seoMetadata.ts');
const geo = read('apps/catalog-frontend/src/data/egyptGeoDiscovery.ts');
const taxonomy = read('apps/catalog-frontend/src/data/productionDefaults.ts');

assert.ok(directory.includes("get('governorate')"), 'Directory must read a shareable governorate scope from the URL.');
assert.ok(directory.includes('initialRouteGovernorate'), 'A valid governorate route must take precedence over a saved location preference.');
assert.ok(directory.includes("applyGovernorateScope('المنوفية')"), 'The main directory must provide a direct Menoufia catalog action.');
assert.ok(directory.includes("applyGovernorateScope('all')"), 'Visitors must be able to return to all governorates.');
assert.ok(directory.includes('data-testid="menoufia-directory-scope"'), 'The active directory scope must be exposed to browser tests and assistive tooling.');
assert.ok(directory.includes('EGYPT_GEO_GOVERNORATES.find'), 'Only a known Egyptian governorate can be selected from the route.');
assert.ok(directory.includes('const PUBLIC_UNCLAIMED_DIRECTORY_LISTINGS_ENABLED = false'), 'Unclaimed public listings must remain disabled until the privacy and publication release is complete.');
assert.ok(directory.includes('if (!PUBLIC_UNCLAIMED_DIRECTORY_LISTINGS_ENABLED)'), 'The UI must not bypass the disabled unclaimed-listings fetch gate.');

assert.ok(app.includes("import { EGYPT_GEO_GOVERNORATES } from './data/egyptGeoDiscovery'"), 'SEO route resolution must use the canonical Egypt geographic source.');
assert.ok(app.includes('governorate.name === requestedGovernorate'), 'SEO must reject arbitrary or unrecognized governorate query values.');
assert.ok(app.includes('governorateName,'), 'Validated governorate scope must be passed to route SEO.');
assert.ok(seo.includes('governorateName?: string'), 'Route SEO must accept a geographic scope.');
assert.ok(seo.includes('searchParams.set(\'governorate\', input.governorateName.trim())'), 'Activity canonical URLs must preserve the validated governorate.');
assert.ok(seo.includes('دليل الأنشطة والخدمات في محافظة ${governorate}'), 'Governorate landing pages must have dedicated metadata.');
assert.ok(geo.includes('id:"EG17","name":"المنوفية"'), 'The canonical geographic dataset must include Menoufia (EG17).');

const categories = Array.from(
  taxonomy.matchAll(/^\\s*s\\('([^']+)','([^']+)','activity','([^']+)'/gm),
  (match) => ({ group: match[1], code: match[2], name: match[3] }),
);
assert.equal(categories.length, 50, 'Menoufia catalog must reuse the existing 50 canonical activity categories.');
assert.equal(new Set(categories.map((item) => item.group)).size, 10, 'The canonical 10-group activity taxonomy must remain intact.');
assert.equal(new Set(categories.map((item) => item.group + ':' + item.code)).size, 50, 'Canonical activity identifiers must remain unique.');

console.log('MENOUFIA_ACTIVITY_CATALOG=PASS');
console.log('GOVERNORATE_ROUTE=PASS; SHAREABLE=YES; UNCLAIMED_LISTINGS_STAY_CLOSED=YES');
console.log('CANONICAL_ACTIVITY_CATEGORIES=' + categories.length + '; FUNCTIONAL_GROUPS=10');
