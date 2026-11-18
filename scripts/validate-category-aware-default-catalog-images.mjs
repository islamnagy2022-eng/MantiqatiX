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

const assetPattern = new RegExp('legacy/(?:activity|activities)/[a-z0-9_-]+[.]svg', 'g');
const referencedAssets = [...defaults.matchAll(assetPattern)].map((match) => match[0]);
assert.ok(referencedAssets.length >= 10, 'the resolver must offer a broad category-specific artwork set');
for (const asset of new Set(referencedAssets)) {
  assert.ok(fs.existsSync(path.join('apps/catalog-frontend/public', asset)), 'default catalog artwork is missing: ' + asset);
}

// Keep specialist categories ahead of the broad home/repair matcher so that
// maintenance catalogs use their dedicated artwork rather than generic home art.
const maintenanceRule = defaults.indexOf("if (/صيانة|تصليح|إصلاح|سباك|نجار|حداد|تكييف|maintenance|repair|plumb|carpenter|handyman|air conditioning/.test(text)) return 'maintenance';");
const broadHomeRule = defaults.indexOf("if (/عقار|عقارات|تشطيب|ديكور|أثاث|منزل|مفروشات|سباكة|نجار|حداد|صيانة|تنظيف|home|furniture|real estate|property|maintenance|repair|plumb|carpenter/.test(text))");
assert.ok(maintenanceRule >= 0 && broadHomeRule > maintenanceRule,
  'maintenance activity inference must run before the broad home category matcher');
const maintenanceAssetMapping = "maintenance: 'legacy/activities/maintenance.svg'";
assert.equal(defaults.split(maintenanceAssetMapping).length - 1, 2,
  'activity and product/service defaults must both use the dedicated maintenance artwork');

const addStart = context.indexOf('const addBusiness = async');
const addEnd = context.indexOf('const updateBusinessLocation', addStart);
assert.ok(addStart >= 0 && addEnd > addStart, 'the production activity-creation flow must exist');
const addBusiness = context.slice(addStart, addEnd);
assert.ok(addBusiness.includes('const needsLogo = !data.logoUrl?.trim();'), 'an owner-supplied logo must be preserved');
assert.ok(addBusiness.includes('const needsCover = !data.coverUrl?.trim();'), 'an owner-supplied cover must be preserved');
assert.ok(addBusiness.includes('generatedLogo || resolveDefaultImage({') && addBusiness.includes("kind: 'activity',"),
  'AI logo failure must fall back to category artwork');
assert.ok(addBusiness.includes('generatedCover || resolveDefaultImage({') && addBusiness.includes("kind: 'cover',"),
  'AI cover failure must fall back to category artwork');
assert.ok(addBusiness.includes("profileImageSettings.logo_image_source = generatedLogo ? 'ai' : 'auto';"),
  'logo provenance must distinguish generated from automatic artwork');
assert.ok(addBusiness.includes("profileImageSettings.cover_image_source = generatedCover ? 'ai' : 'auto';"),
  'cover provenance must distinguish generated from automatic artwork');
assert.ok(!addBusiness.includes('if (generatedLogo || generatedCover)'),
  'fallback images must be persisted even when AI returns no image');
assert.ok(addBusiness.includes('settings: { catalog_profile: profileImageSettings }'),
  'default imagery must be linked to the created catalog profile');

assert.ok(production.includes('const categoryDefaultLogo = resolveDefaultImage'), 'business mapping must resolve a category-aware logo default');
assert.ok(production.includes('const categoryDefaultCover = resolveDefaultImage'), 'business mapping must resolve a category-aware cover default');
assert.ok(production.includes('logoUrl: doctorFallbackLogo || pharmacyFallbackLogo || (logoNeedsDefault ? categoryDefaultLogo : savedLogo)'),
  'business mapping must never return an empty logo for an unbranded catalog');
assert.ok(production.includes('coverUrl: doctorFallbackCover || pharmacyFallbackCover || (coverNeedsDefault ? categoryDefaultCover : savedCover)'),
  'business mapping must never return an empty cover for an unbranded catalog');

assert.ok(profileHeader.includes("kind: 'activity'"), 'storefront header must render a category-aware logo default');
assert.ok(profileHeader.includes("kind: 'cover'"), 'storefront header must render a category-aware cover default');
assert.ok(profileHeader.includes('image.src = defaultCover'), 'broken merchant covers must fall back to the category artwork');
assert.ok(profileHeader.includes('image.src = defaultLogo'), 'broken merchant logos must fall back to the category artwork');

assert.ok(marketplace.includes('const defaultCover = resolveDefaultImage'), 'marketplace cards must have a wide category-aware cover');
assert.ok(marketplace.includes('image.src = defaultCover'), 'broken marketplace covers must fall back locally');
assert.ok(marketplace.includes('image.src = defaultLogo'), 'broken marketplace logos must fall back locally');
assert.ok(marketplace.includes('const defaultImage = resolveDefaultImage'), 'marketplace product cards must have a product/service default');
assert.ok(marketplace.includes('target.src = defaultImage'), 'broken marketplace product images must fall back locally');

assert.ok(context.includes("kind: data.type === 'service' ? 'service' : 'product'"),
  'new products and services must receive type-aware artwork');
assert.ok(catalogSection.includes('import { resolveDefaultImage }'), 'storefront product cards must share the category-aware resolver');
assert.ok(catalogSection.includes('image.src = resolveDefaultImage({'), 'broken storefront product images must fall back by category');

const directoryListings = read('apps/catalog-frontend/src/components/DirectoryListingsView.tsx');
assert.ok(directoryListings.includes("import { resolveDefaultImage } from \"../utils/defaultImages\";"),
  'standalone directory pages must use the shared category-aware image resolver');
assert.ok(directoryListings.includes('listingDefaultProfileImage') && directoryListings.includes("kind: \"activity\""),
  'every directory listing must receive a local category-aware profile image when no owner image exists');
assert.ok(directoryListings.includes('listingDefaultCoverImage') && directoryListings.includes("kind: \"cover\""),
  'every directory listing must receive a wide category-aware cover when no owner cover exists');
assert.ok(directoryListings.includes('listing.metadata?.logoUrl') && directoryListings.includes('listing.metadata?.profileImageUrl'),
  'valid owner-provided profile/logo imagery must retain precedence over defaults');
assert.ok(directoryListings.includes('listing.metadata?.coverUrl') && directoryListings.includes('listing.metadata?.cover_url'),
  'valid owner-provided cover imagery must retain precedence over defaults');
assert.ok(directoryListings.includes('image.dataset.defaultApplied === "true"') &&
  directoryListings.includes('image.src = listingDefaultCoverImage(detail)') &&
  directoryListings.includes('image.src = listingDefaultProfileImage(detail)'),
  'broken uploaded profile and cover URLs must fall back once to the local category artwork');
assert.ok(directoryListings.includes('listing.functional_group_id') && directoryListings.includes('listing.taxonomy_category_id'),
  'directory image selection must use canonical category context rather than only doctor/pharmacy type');

console.log('CATEGORY_AWARE_DEFAULT_CATALOG_IMAGES=PASS');
console.log('DEFAULT_ACTIVITY_ASSETS=' + new Set(referencedAssets).size);
console.log('MAINTENANCE_DEFAULT_ART=PASS');
