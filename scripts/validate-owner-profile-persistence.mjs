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
    !migration.includes("CATALOG_PUBLISH_REQUIRES_OWNER")) {
  throw new Error('FAIL: global business profile writes must remain owner/admin scoped; branch managers must not change business-wide identity through this RPC.');
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
for (const [source, expected, label] of [
  [catalogAdmin, 2, 'catalog admin read paths'],
  [publicDirectory, 1, 'public directory read path'],
  [publicCatalog, 1, 'public catalog read path'],
]) {
  const count = source.split('google_maps_url: String(profile.google_maps_url || "")').length - 1;
  if (count !== expected) throw new Error('FAIL: saved Google Maps URL absent from ' + label + '. Expected ' + expected + ', got ' + count);
}
if (!/googleMapsUrl:\s*String\(profile\.google_maps_url \|\| ''\)/.test(mapper)) {
  throw new Error('FAIL: frontend mapper must restore the persisted Google Maps URL.');
}

console.log('Owner profile persistence contract: PASS');
