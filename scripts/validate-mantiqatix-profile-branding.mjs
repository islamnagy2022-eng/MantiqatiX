import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const component = readFileSync('apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx', 'utf8');
const marketplace = readFileSync('apps/catalog-frontend/src/components/MarketplaceHome.tsx', 'utf8');
const activity = readFileSync('apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx', 'utf8');
const utility = readFileSync('apps/catalog-frontend/src/utils/defaultImages.ts', 'utf8');
const defaults = readFileSync('apps/catalog-frontend/src/utils/defaultImages.ts', 'utf8');

assert.match(component, /isMantiqatiXBrandName/);
assert.match(utility, /export function isMantiqatiXBrandName/);
assert.match(marketplace, /isMantiqatiXBrandName\(business\.name\)/);
assert.match(marketplace, /isPlatformBrandProfile \? defaultLogo : business\.logoUrl/);
assert.match(marketplace, /isPlatformBrandProfile \? defaultCover : business\.coverUrl/);
assert.match(activity, /isMantiqatiXBrandName\(business\.name\) \? resolveDefaultImage\(\{ name: business\.name, kind: 'cover' \}\)/);
assert.match(activity, /isMantiqatiXBrandName\(business\.name\) \? resolveDefaultImage\(\{ name: business\.name, kind: 'activity' \}\)/);
assert.match(component, /return \[isPlatformBrandProfile \? defaultCover : currentBusiness\.coverUrl \|\| defaultCover\]/);
assert.match(component, /src=\{isPlatformBrandProfile \? defaultLogo : currentBusiness\.logoUrl \|\| defaultLogo\}/);
assert.match(component, /merchantCovers\.length > 0\) return merchantCovers\.slice\(0, 2\)/);
assert.match(defaults, /mantiqatix-brand-logo\.svg/);
assert.match(defaults, /mantiqatix-brand-cover\.svg/);
assert.ok(existsSync('apps/catalog-frontend/public/mantiqatix-brand-logo.svg'), 'first-party logo asset must exist');
assert.ok(existsSync('apps/catalog-frontend/public/mantiqatix-brand-cover.svg'), 'first-party cover asset must exist');

console.log('PASS: MantiqatiX official profile uses first-party logo/cover; merchant cover gallery remains preserved.');
