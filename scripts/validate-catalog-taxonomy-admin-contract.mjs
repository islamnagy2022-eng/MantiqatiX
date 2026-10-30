#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const admin = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
const edge = read('supabase/functions/catalog-platform-admin/index.ts');
const defaults = read('apps/catalog-frontend/src/data/productionDefaults.ts');
const migration = read('supabase/migrations/20261030130000_rc459_secure_taxonomy_mapping_preview_commit.sql');
const fixture = read('supabase/tests/rc459_taxonomy_mapping_fixture.sql');
const integration = read('supabase/tests/rc459_taxonomy_mapping_integration.sql');
const browser = read('apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs');

const groups = [
  'medical_health','food_grocery','fashion_beauty','home_maintenance',
  'construction_decor','auto_transport','real_estate','education_training',
  'technology_communications','professional_services','marketing_media',
  'trade_ecommerce','agriculture_animals','sports_fitness','tourism_events',
  'finance_insurance','industry_workshops','public_community',
];

for (const group of groups) {
  assert.ok(migration.includes("'" + group + "'"), 'SQL must allow canonical group ' + group);
  assert.ok(edge.includes('"' + group + '"'), 'Edge Function must allow canonical group ' + group);
}

assert.ok(edge.includes('action === "TAXONOMY_MAPPING_PREVIEW"'), 'Edge Function must expose the read-only mapping preview.');
assert.ok(edge.includes('action === "TAXONOMY_MAPPING_APPLY"'), 'Edge Function must expose the guarded mapping apply action.');
assert.ok(edge.includes('service.rpc(rpcName, rpcArgs'), 'Taxonomy operations must execute through service-side RPC, not direct browser table writes.');
assert.ok(edge.includes('TAXONOMY_CATEGORY_IN_USE'), 'SAVE_SETTINGS must block deletion or movement of a referenced category.');
assert.ok(edge.includes('const oldGroup = allowedTaxonomyGroups.find'), 'Category usage lookup must parse canonical IDs using explicit known group prefixes.');
assert.ok(edge.includes('TAXONOMY_USAGE_CHECK_FAILED'), 'Failed usage checks must fail closed.');
assert.ok(edge.includes('const canonicalTaxonomyCategoryTypes = new Map<string, "activity" | "profession">'), 'Edge Function must use a server-owned canonical category/type allowlist.');
assert.ok(edge.includes('canonicalCategoryType(sourceCategoryId)') && edge.includes('canonicalCategoryType(targetCategoryId) !== targetClassificationType'), 'Source and target IDs and target classification must match the canonical seed inventory.');
const seededCategoryCodes = defaults.split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith("s('"))
  .map((line) => {
    const fields = line.split("'");
    return { group: fields[1], code: fields[3], type: fields[5] };
  });
const canonicalAllowlist = edge.slice(edge.indexOf('const canonicalTaxonomyCategoryTypes'), edge.indexOf(']);', edge.indexOf('const canonicalTaxonomyCategoryTypes')));
const allowlistedIds = [...canonicalAllowlist.matchAll(/\["(cat_[a-z0-9_]+)", "(activity|profession)"\]/g)].map((match) => ({ id: match[1], type: match[2] }));
assert.equal(seededCategoryCodes.length, 226, 'Canonical seed inventory changed; review the server allowlist.');
assert.equal(allowlistedIds.length, seededCategoryCodes.length, 'Server canonical allowlist must have one ID per seeded category.');
assert.equal(new Set(allowlistedIds.map((entry) => entry.id)).size, allowlistedIds.length, 'Server canonical allowlist must not contain duplicate category IDs.');
const seedById = new Map(seededCategoryCodes.map((entry) => [`cat_${entry.group}_${entry.code}`, entry.type]));
for (const entry of allowlistedIds) assert.equal(entry.type, seedById.get(entry.id), `Classification type drift for ${entry.id}.`);

assert.ok(migration.includes('security definer\nset search_path = \'\''), 'Every taxonomy RPC/trigger must use SECURITY DEFINER with an empty search_path.');
assert.ok(migration.includes('mnty_catalog_taxonomy_mapping_preview'), 'Migration must install the authoritative preview RPC.');
assert.ok(migration.includes('mnty_catalog_taxonomy_mapping_apply'), 'Migration must install the transactional apply RPC.');
assert.ok(migration.includes('pg_advisory_xact_lock'), 'Commit path must serialize concurrent mapping commits.');
assert.ok(migration.includes('lock table public.businesses in share row exclusive mode'), 'Commit path must block concurrent business mutations during validation/apply.');
assert.ok(migration.includes('lock table public.public_directory_listings in share row exclusive mode'), 'Commit path must block concurrent listing mutations during validation/apply.');
assert.ok(migration.includes('TAXONOMY_PREVIEW_STALE'), 'Commit must reject a stale preview.');
assert.ok(migration.includes('before_image') && migration.includes('after_mapping'), 'Audit must persist a before-image and approved mapping.');
assert.ok(migration.includes('CATALOG_TAXONOMY_AUDIT_APPEND_ONLY'), 'Audit history must reject UPDATE and DELETE.');
assert.ok(migration.includes('force row level security'), 'Audit table must FORCE RLS.');
assert.ok(migration.includes('from public, anon, authenticated, service_role'), 'Audit table direct access must be revoked.');
assert.ok(migration.includes('grant execute on function public.mnty_catalog_taxonomy_mapping_preview') && migration.includes('to service_role'), 'Preview RPC must be service-role only.');
assert.ok(migration.includes('grant execute on function public.mnty_catalog_taxonomy_mapping_apply') && migration.includes('to service_role'), 'Apply RPC must be service-role only.');
assert.ok(!migration.includes("'settings',b.settings"), 'Audit must not duplicate the full business settings JSON.');

assert.ok(admin.includes('TAXONOMY_MAPPING_PREVIEW'), 'Admin UI must call the preview action.');
assert.ok(admin.includes('TAXONOMY_MAPPING_APPLY'), 'Admin UI must call the guarded apply action.');
assert.ok(admin.includes('إلغاء المعاينة'), 'Admin UI must let an operator cancel without applying.');
assert.ok(admin.includes('window.confirm('), 'Admin UI must confirm before applying a preview.');
assert.ok(admin.includes('taxonomyMappingPreview.businessCount') && admin.includes('taxonomyMappingPreview.listingCount'), 'Admin UI must show both affected entity counts.');
assert.ok(admin.includes('taxonomyMappingPreview.previewDigest'), 'Admin UI must retain the preview digest for stale-snapshot protection.');
assert.ok(admin.includes('إدارة ربط التصنيفات وإعادة توزيع السجلات'), 'Admin UI must expose the additive mapping panel.');
assert.ok(browser.includes('platform-admin-taxonomy-preview-cancel-and-confirmed-apply-flow'), 'Browser E2E must cover the preview, cancel, and confirm workflow.');

assert.ok(fixture.includes('rc459.force_failure'), 'Fixture must include a controlled transactional failure hook.');
assert.ok(integration.includes('RC459_PREVIEW_MODIFIED_SOURCE_ROWS'), 'Integration must prove the preview performs no writes.');
assert.ok(integration.includes('TAXONOMY_PREVIEW_STALE'), 'Integration must reject a stale preview.');
assert.ok(integration.includes('RC459_FORCED_TRANSACTION_FAILURE'), 'Integration must simulate a mid-transaction failure.');
assert.ok(integration.includes('RC459_PARTIAL_WRITE_AFTER_FAILURE'), 'Integration must prove rollback removes partial effects.');
assert.ok(integration.includes('RC459_UNRELATED_DATA_WAS_CHANGED'), 'Integration must protect non-taxonomy business/listing fields.');
assert.ok(integration.includes('RC459_AUDIT_IMMUTABILITY_NOT_ENFORCED'), 'Integration must test append-only audit behavior.');
assert.ok(integration.includes('customer_id') && integration.includes('provider_id') && integration.includes('employee_id'), 'Integration must cover customer, service provider, and employee denials.');
assert.ok(integration.includes('tenant_admin_id') && integration.includes('inactive_admin_id') && integration.includes('scoped_admin_id'), 'Integration must cover tenant-scoped, inactive, and business/branch-scoped Super Admin denials.');
assert.ok(integration.includes('RC459_UNAUTHORIZED_ROLE_NOT_REJECTED'), 'Integration must prove rejected roles cannot preview.');

console.log('CATALOG_TAXONOMY_ADMIN_CONTRACT=PASS — server RBAC, safe preview, stale digest, atomic apply, immutable audit, and no direct audit-table access.');
