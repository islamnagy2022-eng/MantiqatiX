import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const merchant = read('apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx');
const mapper = read('apps/catalog-frontend/src/lib/production.ts');
const migration = read('supabase/migrations/20261027111500_preserve_catalog_profile_metadata.sql');
const catalogAdmin = read('supabase/functions/catalog-admin/index.ts');
const publicDirectory = read('supabase/functions/public-catalog-directory/index.ts');
const publicCatalog = read('supabase/functions/public-catalog/index.ts');

if (!/const updateBusiness = async \(updated: Business\): Promise<void>/.test(context) ||
    !/await callCatalogAdmin\(\{\s*action: 'BUSINESS_PROFILE_UPSERT'/.test(context) ||
    !/await refreshBusinessCatalog\(updated\.id\)/.test(context) ||
    /void \(async \(\) =>/.test(context.slice(context.indexOf('const updateBusiness = async'), context.indexOf('const addBusiness = async')))) {
  throw new Error('FAIL: owner profile saves must await the production write and catalog refresh and propagate errors.');
}

const updateStart = context.indexOf('const updateBusiness = async');
const updateEnd = context.indexOf('const addBusiness = async', updateStart);
const updateBlock = updateStart >= 0 && updateEnd > updateStart ? context.slice(updateStart, updateEnd) : '';
if (!updateBlock || /callPlatformAdmin|BUSINESS_SETTINGS_UPDATE/.test(updateBlock)) {
  throw new Error('FAIL: profile edits must not rewrite billing metadata from a potentially stale client snapshot.');
}

const saveStart = merchant.indexOf('const handleSaveBusiness = async');
const saveEnd = merchant.indexOf('const openAddModal =', saveStart);
if (saveStart < 0 || saveEnd <= saveStart) {
  throw new Error('FAIL: merchant profile save handler missing or malformed.');
}
const saveHandler = merchant.slice(saveStart, saveEnd);
const villageFieldStart = merchant.indexOf('القرية / الحي / البلدة (اختياري)');
const villageFieldEnd = merchant.indexOf('</div>', villageFieldStart);
const villageField = villageFieldStart >= 0 && villageFieldEnd > villageFieldStart
  ? merchant.slice(villageFieldStart, villageFieldEnd)
  : '';
if (/\[bizGov, bizMarkaz, bizVillage\]\.every/.test(saveHandler) ||
    !/\[bizGov, bizMarkaz\]\.every/.test(saveHandler) ||
    !villageField ||
    /\brequired\b/.test(villageField)) {
  throw new Error('FAIL: village/district must remain optional in both validation and HTML; governorate and markaz are the required location fields.');
}
if (!/await updateBusiness\(\{/.test(saveHandler) ||
    saveHandler.indexOf('await updateBusiness({') > saveHandler.indexOf('setSaveSuccess(true)') ||
    !/catch \(error\)/.test(saveHandler) ||
    !/setProfileSaveError\(/.test(saveHandler) ||
    !/finally/.test(saveHandler)) {
  throw new Error('FAIL: merchant profile UI must show success only after persistence, and display save errors.');
}
if (/setBizGov\(currentBusiness\?\.governorate \|\| ['"]الدقهلية['"]\)/.test(merchant) ||
    /setBizMarkaz\(currentBusiness\?\.markaz \|\| ['"]المنصورة['"]\)/.test(merchant) ||
    /setBizVillage\(currentBusiness\?\.village \|\| ['"]حي الجامعة['"]\)/.test(merchant)) {
  throw new Error('FAIL: merchant profile must not invent the location of a business.');
}
for (const [pattern, label] of [
  [/bizCategory/, 'taxonomy edits must not be shown when the write contract cannot persist them'],
  [/bizFunctionalGroup/, 'functional group edits must not be shown when the write contract cannot persist them'],
  [/bizGoogleMapsUrl/, 'an editable maps URL must not be shown until its write contract exists'],
]) {
  if (pattern.test(merchant)) throw new Error('FAIL: ' + label);
}

if (!migration.includes('CREATE OR REPLACE FUNCTION public.upsert_catalog_business_profile_backend(') ||
    !migration.includes('SELECT CASE') ||
    !migration.includes('FOR UPDATE') ||
    !migration.includes("coalesce(v_profile, '{}'::jsonb) || jsonb_build_object")) {
  throw new Error('FAIL: the forward migration must lock and merge the current catalog_profile instead of replacing it.');
}
if (migration.includes("IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER')") ||
    !migration.includes("upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN')") ||
    !migration.includes("AND m.branch_id IS NULL") ||
    !migration.includes("CATALOG_PUBLISH_REQUIRES_OWNER") ||
    migration.includes("'{catalog_public_enabled}'")) {
  throw new Error('FAIL: global profile writes must require business-wide owner/admin scope and must not change the separate catalog publication flag from a stale client snapshot.');
}

if (migration.includes("'publicEnabled', coalesce(p_public_enabled, false)") ||
    !migration.includes("v_public_enabled boolean := false;") ||
    !migration.includes("coalesce(b.settings->'catalog_public_enabled' = 'true'::jsonb, false)") ||
    !migration.includes("INTO v_profile, v_public_enabled") ||
    !migration.includes("'publicEnabled', v_public_enabled")) {
  throw new Error('FAIL: profile RPC must report the persisted catalog publication state, not echo a stale client argument.');
}

for (const marker of [
  'UNAUTHENTICATED',
  'INVALID_BUSINESS_PROFILE',
  'CATALOG_PROFILE_WRITE_FORBIDDEN',
  'BRANCH_BUSINESS_MISMATCH',
  'ACTIVE_PROVIDER_PROFILE_REQUIRED',
  'REVOKE ALL ON FUNCTION public.upsert_catalog_business_profile_backend',
  'GRANT EXECUTE ON FUNCTION public.upsert_catalog_business_profile_backend',
]) {
  if (!migration.includes(marker)) throw new Error('FAIL: migrated profile write is missing safety contract: ' + marker);
}

// Authenticated catalog-admin reads retain private operational data. Public read paths
// must use the consent-gated projection instead of copying raw profile maps.
const adminMapsCount = catalogAdmin.split('google_maps_url: String(profile.google_maps_url || "")').length - 1;
if (adminMapsCount !== 2) {
  throw new Error('FAIL: authenticated catalog-admin read paths must retain both private profile map fields. Expected 2, got ' + adminMapsCount);
}
for (const [source, label] of [
  [publicDirectory, 'public directory'],
  [publicCatalog, 'public catalog'],
]) {
  if (!source.includes('google_maps_url: publicContact.googleMapsUrl') ||
      source.includes('google_maps_url: String(profile.google_maps_url || "")') ||
      !source.includes('getExplicitPublicContact(')) {
    throw new Error('FAIL: ' + label + ' must return Google Maps URLs only through the audited public-contact projection.');
  }
}
if (!/googleMapsUrl:\s*isPublicProjection && !hasAuditedPublicContact \? '' : String\(profile\.google_maps_url \|\| ''\)/.test(mapper)) {
  throw new Error('FAIL: frontend mapper must restore the Google Maps URL supplied by the consent-gated server projection.');
}

console.log('Owner profile persistence contract: PASS');
