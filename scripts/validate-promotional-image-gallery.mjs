import fs from "node:fs";
import assert from "node:assert/strict";

const read = (path) => fs.readFileSync(path, "utf8");
const typeSource = read("apps/catalog-frontend/src/types/index.ts");
const merchant = read("apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx");
const storefront = read("apps/catalog-frontend/src/components/storefront/BusinessProfileHeader.tsx");
const context = read("apps/catalog-frontend/src/context/AppContext.tsx");
const mapper = read("apps/catalog-frontend/src/lib/production.ts");
const catalogAdmin = read("supabase/functions/catalog-admin/index.ts");
const publicDirectory = read("supabase/functions/public-catalog-directory/index.ts");
const publicCatalog = read("supabase/functions/public-catalog/index.ts");
const shared = read("supabase/functions/_shared/promotional-images.mjs");
const galleryCapability = read("apps/catalog-frontend/src/utils/promotionalGalleryCapability.ts");
const galleryCapabilityTests = read("apps/catalog-frontend/tests/promotional-gallery-capability.test.ts");

assert.match(typeSource, /promotionalImages\?: string\[\]/, "Business type must expose the separate promotional gallery");
assert.match(merchant, /id="business-promotional-images"/, "merchant dashboard must expose the promotional image editor");
assert.match(merchant, /MAX_PROMOTIONAL_IMAGES|normalizePromotionalImageLines/, "merchant editor must use the URL validation helper");
assert.match(merchant, /promotionalImages: promotionalImages\.images/, "merchant save must send the normalized image list");
assert.match(context, /Array\\.isArray\\(updated\\.promotionalImages\\) \\? \\{ promotionalImages: updated\\.promotionalImages \\} : \\{\\}/, "business profile updates must send the gallery only when explicitly provided and must not clear it when omitted");
assert.match(context, /hasPromotionalGalleryChanges\(currentGallery, updated\.promotionalImages\)/, "profile saves must detect gallery changes separately");
assert.match(context, /Array\.isArray\(updated\.promotionalImages\) \? \{ promotionalImages: updated\.promotionalImages \} : \{\}/, "omitted optional gallery fields must not be sent as an empty list that clears stored images");
assert.match(context, /action: 'CATALOG_READ'[\s\S]*?hasPromotionalGalleryCapability\(capabilityRead\)/, "gallery writes must probe the deployed Edge read contract before any mutation");
const updateBusinessBlock = context.slice(context.indexOf("const updateBusiness ="), context.indexOf("const addBusiness ="));
assert.ok(updateBusinessBlock.indexOf("if (hasPromotionalGalleryChanges") >= 0
  && updateBusinessBlock.indexOf("if (hasPromotionalGalleryChanges") < updateBusinessBlock.indexOf("action: 'BUSINESS_PROFILE_UPSERT'"),
  "unsupported gallery changes must fail before the legacy profile write can return a false success");
assert.match(galleryCapability, /hasPromotionalGalleryCapability/);
assert.match(galleryCapability, /hasPromotionalGalleryChanges/);
assert.match(galleryCapabilityTests, /fails closed for older catalog-admin bundles/);
assert.match(mapper, /promotionalImages: normalizePromotionalImageLines/, "catalog mapping must normalize persisted gallery URLs");
assert.match(catalogAdmin, /validatePromotionalImages\(body\.promotionalImages\)/, "server-side profile action must validate owner-submitted URLs");
assert.match(catalogAdmin, /promotional_images/, "server-side profile action must pass gallery URLs to the persistence layer");
assert.match(catalogAdmin, /upsert_catalog_business_profile_atomic_backend/, "owner profile and gallery changes must use the atomic profile RPC");
assert.match(catalogAdmin, /p_profile_metadata: submittedProfileMetadata/, "gallery metadata must be persisted in the same RPC transaction as standard profile fields");
assert.equal((catalogAdmin.match(/promotionalImages: sanitizePublicPromotionalImages\(profile\.promotional_images\)/g) || []).length, 2, "both branchless and active-branch CATALOG_READ responses must expose the gallery capability marker");
assert.doesNotMatch(catalogAdmin, /imageSourceWriteError|socialWriteError|savedProfileSettings/, "legacy service-role JSONB read/merge/write persistence must be removed");
assert.match(publicDirectory, /sanitizePublicPromotionalImages\(profile\.promotional_images\)/, "directory projection must sanitize public gallery URLs");
assert.match(publicCatalog, /sanitizePublicPromotionalImages\(profile\.promotional_images\)/, "storefront projection must sanitize public gallery URLs");
assert.match(shared, /MAX_PROMOTIONAL_IMAGES = 10/, "server contract must cap the gallery at ten images");
assert.match(storefront, /data-testid="storefront-promotional-gallery"/, "storefront must render a separate promotional gallery");
assert.match(storefront, /const coverImage =/, "storefront must use one fixed cover image");
assert.doesNotMatch(storefront, /currentBusiness\.coverImages|currentSlideIndex|slides\.map/, "legacy multi-cover rotation must not control the storefront cover");

console.log("PROMOTIONAL_IMAGE_GALLERY_CONTRACT=PASS");