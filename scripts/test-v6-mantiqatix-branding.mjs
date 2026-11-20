import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || '');
const assets = resolve(process.argv[3] || '');
const source = readFileSync(join(root, 'src/data/imageAssets.ts'), 'utf8');
const logo = readFileSync(join(root, 'public/mantiqatix-brand-logo.svg'), 'utf8');
const cover = readFileSync(join(root, 'public/mantiqatix-brand-cover.svg'), 'utf8');
const originalLogo = readFileSync(join(assets, 'mantiqatix-brand-logo.svg'), 'utf8');
const originalCover = readFileSync(join(assets, 'mantiqatix-brand-cover.svg'), 'utf8');

assert.match(source, /isMantiqatiXBrandBusiness/);
assert.match(source, /name\?: string \| null; logoUrl\?: string \| null/);
assert.match(source, /name\?: string \| null; coverUrl\?: string \| null/);
assert.match(source, /resolveV6PublicAsset\('mantiqatix-brand-logo\.svg'\)/);
assert.match(source, /resolveV6PublicAsset\('mantiqatix-brand-cover\.svg'\)/);
assert.ok(source.indexOf('if (isMantiqatiXBrandBusiness(business))') < source.indexOf("const raw = business?.logoUrl"), 'official logo must take precedence over persisted social CDN media');
assert.ok(source.indexOf('if (isMantiqatiXBrandBusiness(business))') < source.indexOf("const raw = business?.coverUrl"), 'official cover must take precedence over persisted social CDN media');
assert.equal(logo, originalLogo, 'V6 logo must exactly match the canonical first-party SVG');
assert.equal(cover, originalCover, 'V6 cover must exactly match the canonical first-party SVG');
assert.ok(statSync(join(root, 'public/mantiqatix-brand-logo.svg')).size > 100);
assert.ok(statSync(join(root, 'public/mantiqatix-brand-cover.svg')).size > 100);

console.log('V6_MANTIQATIX_BRANDING_SOURCE_CONTRACT=PASS');
