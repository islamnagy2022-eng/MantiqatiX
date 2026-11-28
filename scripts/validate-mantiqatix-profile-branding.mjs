import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const component = readFileSync('apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx', 'utf8');
const marketplace = readFileSync('apps/catalog-frontend/src/components/MarketplaceHome.tsx', 'utf8');
const activity = readFileSync('apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx', 'utf8');
const utility = readFileSync('apps/catalog-frontend/src/utils/defaultImages.ts', 'utf8');
const defaults = readFileSync('apps/catalog-frontend/src/utils/defaultImages.ts', 'utf8');

assert.match(component, /isMantiqatiXBrandName/);
assert.match(utility, /export function isMantiqatiXBrandName/);
assert.ok(utility.includes('replace(/\\s+/g'), 'brand-name matching must normalize whitespace');
assert.match(marketplace, /isMantiqatiXBrandName\(business\.name\)/);
assert.match(marketplace, /const logo = business\.logoUrl \|\| defaultLogo/);
assert.match(marketplace, /const cover = business\.coverUrl \|\| defaultCover/);
assert.ok(activity.includes("business.coverUrl || resolveDefaultImage({ name: business.name, description: business.bio, category: business.category, kind: 'cover' })"),
  'activity cover defaults must use the business description and category for relevant artwork');
assert.ok(activity.includes("business.logoUrl || resolveDefaultImage({ name: business.name, description: business.bio, category: business.category, kind: 'activity' })"),
  'activity logo defaults must use the business description and category for relevant artwork');
assert.match(component, /const coverImage = isPlatformBrandProfile \? defaultCover : currentBusiness\?\.coverUrl \|\| defaultCover/);
assert.match(component, /src=\{currentBusiness\.logoUrl \|\| defaultLogo\}/);
assert.doesNotMatch(component, /currentBusiness\.coverImages|merchantCovers|currentSlideIndex|slides\.map/, 'legacy multi-cover rotation must not be used for the main cover');
assert.match(component, /data-testid="storefront-promotional-gallery"/, 'promotional images must have a separate gallery');
assert.match(defaults, /mantiqatix-brand-logo\.svg/);
assert.match(defaults, /mantiqatix-brand-cover\.svg/);
assert.ok(existsSync('apps/catalog-frontend/public/mantiqatix-brand-logo.svg'), 'first-party logo asset must exist');
assert.ok(existsSync('apps/catalog-frontend/public/mantiqatix-brand-cover.svg'), 'first-party cover asset must exist');

console.log('PASS: MantiqatiX official profile uses first-party logo/cover; one fixed cover is retained and promotional images live in a separate gallery.');
