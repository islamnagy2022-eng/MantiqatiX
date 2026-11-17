#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (file) => fs.readFileSync(file, 'utf8');
const defaults = read('apps/catalog-frontend/src/utils/defaultImages.ts');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const production = read('apps/catalog-frontend/src/lib/production.ts');
const profileHeader = read('apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx');
const marketplace = read('apps/catalog-frontend/src/components/MarketplaceHome.tsx');
const catalogSection = read('apps/catalog-frontend/src/components/storefront/CatalogSection.tsx');

assert.ok(defaults.includes('export function resolveDefaultImage'), 'category-aware image resolver must remain the common source');
assert.ok(defaults.includes('export function resolveDefaultActivityImages'), 'activity defaults must provide both logo and cover artwork');

const referencedAssets = [...defaults.matchAll(/'((?:legacy\\/(?:activity|activities))\\/[^']+\\.svg)'/g)].map((match) => match[1]);
assert.ok(referencedAssets.length >= 10, 'the resolver must offer a broad category-specific artwork set');
for (const asset of new Set(referencedAssets)) {
  assert.ok(fs.existsSync(path.join('apps/catalog-frontend/public', asset)), `default catalog artwork is missing: ${asset}`);
}

const addStart = context.indexOf('const addBusiness = async');
const addEnd = context.indexOf('const updateBusinessLocation', addStart);
assert.ok(addStart >= 0 && addEnd > addStart, 'the production activity-creation flow must exist');
const addBusiness = context.slice(addStart, addEnd);
assert.match(addBusiness, /const needsLogo = !data\\.logoUrl\\?\\.trim\\(\\)/, 'an owner-supplied logo must be preserved');
assert.match(addBusiness, /const needsCover = !data\\.coverUrl\\?\\.trim\\(\\)/, 'an owner-supplied cover must be preserved');
assert.match(addBusiness, /generatedLogo \\|\\| resolveDefaultImage\\([\\s\\S]*?kind: 'activity'/, 'AI logo failure must fall back to category artwork');
assert.match(addBusiness, /generatedCover \\|\\| resolveDefaultImage\\([\\s\\S]*?kind: 'cover'/, 'AI cover failure must fall back to category artwork');
assert.match(addBusiness, /profileImageSettings\\.logo_image_source = generatedLogo \\? 'ai' : 'auto'/, 'logo provenance must distinguish generated from automatic artwork');
assert.match(addBusiness, /profileImageSettings\\.cover_image_source = generatedCover \\? 'ai' : 'auto'/, 'cover provenance must distinguish generated from automatic artwork');
assert.doesNotMatch(addBusiness, /if \\(generatedLogo \\|\\| generatedCover\\)/, 'fallback images must be persisted even when AI returns no image');
assert.match(addBusiness, /settings: \\{ catalog_profile: profileImageSettings \\}/, 'default imagery must be linked to the created catalog profile');

assert.match(production, /const categoryDefaultLogo = resolveDefaultImage/, 'business mapping must resolve a category-aware logo default');
assert.match(production, /const categoryDefaultCover = resolveDefaultImage/, 'business mapping must resolve a category-aware cover default');
assert.match(production, /logoUrl: doctorFallbackLogo \\|\\| pharmacyFallbackLogo \\|\\| \\(logoNeedsDefault \\? categoryDefaultLogo : savedLogo\\)/, 'business mapping must never return an empty logo for an unbranded catalog');
assert.match(production, /coverUrl: doctorFallbackCover \\|\\| pharmacyFallbackCover \\|\\| \\(coverNeedsDefault \\? categoryDefaultCover : savedCover\\)/, 'business mapping must never return an empty cover for an unbranded catalog');

assert.ok(profileHeader.includes('kind: \'activity\''), 'storefront header must render a category-aware logo default');
assert.ok(profileHeader.includes('kind: \'cover\''), 'storefront header must render a category-aware cover default');
assert.ok(profileHeader.includes('image.src = defaultCover'), 'broken merchant covers must fall back to the category artwork');
assert.ok(profileHeader.includes('image.src = defaultLogo'), 'broken merchant logos must fall back to the category artwork');

assert.ok(marketplace.includes('const defaultCover = resolveDefaultImage'), 'marketplace cards must have a wide category-aware cover');
assert.ok(marketplace.includes('image.src = defaultCover'), 'broken marketplace covers must fall back locally');
assert.ok(marketplace.includes('image.src = defaultLogo'), 'broken marketplace logos must fall back locally');
assert.ok(marketplace.includes('const defaultImage = resolveDefaultImage'), 'marketplace product cards must have a product/service default');
assert.ok(marketplace.includes('target.src = defaultImage'), 'broken marketplace product images must fall back locally');

assert.ok(context.includes('imageUrl = imageSource === \'owner\' || imageSource === \'ai\'') &&
  context.includes('resolveDefaultImage({ name: data.name, description: data.description, category: data.category, kind: data.type === \'service\' ? \'service\' : \'product\' })'),
  'new products and services must receive category-aware local artwork before AI generation');
assert.ok(catalogSection.includes('import { resolveDefaultImage }'), 'storefront product cards must share the category-aware resolver');
assert.ok(catalogSection.includes('image.src = resolveDefaultImage({'), 'broken storefront product images must fall back by category');

console.log('CATEGORY_AWARE_DEFAULT_CATALOG_IMAGES=PASS');
console.log('DEFAULT_ACTIVITY_ASSETS=' + new Set(referencedAssets).size);
