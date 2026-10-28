#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const types = read('apps/catalog-frontend/src/types/index.ts');
const defaults = read('apps/catalog-frontend/src/data/productionDefaults.ts');
const admin = read('apps/catalog-frontend/src/components/admin/AdminDashboard.tsx');
const directory = read('apps/catalog-frontend/src/components/DirectoryView.tsx');
const context = read('apps/catalog-frontend/src/context/AppContext.tsx');
const production = read('apps/catalog-frontend/src/lib/production.ts');
const backend = read('supabase/functions/catalog-platform-admin/index.ts');

const expectedGroups = [
  'medical_health', 'food_grocery', 'fashion_beauty', 'home_maintenance',
  'construction_decor', 'auto_transport', 'real_estate', 'education_training',
  'technology_communications', 'professional_services', 'marketing_media',
  'trade_ecommerce', 'agriculture_animals', 'sports_fitness', 'tourism_events',
  'finance_insurance', 'industry_workshops', 'public_community',
];

const groups = Array.from(defaults.matchAll(/makeGroup\('([^']+)'/g), (match) => match[1]);
assert.equal(groups.length, 18, 'Taxonomy must contain exactly 18 canonical groups.');
assert.deepEqual(groups, expectedGroups, 'Canonical group IDs and display order must not drift.');
assert.ok(types.includes("classificationType?: 'activity' | 'profession'"), 'Taxonomy categories must explicitly distinguish activities from professions.');
assert.ok(types.includes('specialties?: string[]'), 'Taxonomy categories must support third-level specialties.');

const rows = Array.from(
  defaults.matchAll(/^\s*s\('([^']+)','([^']+)','(activity|profession)','([^']+)'/gm),
  (match) => ({ groupId: match[1], code: match[2], kind: match[3], name: match[4] }),
);
assert.ok(rows.length >= 180, `Expected a broad activity/profession directory, found only ${rows.length} entries.`);

const idSet = new Set(groups);
for (const row of rows) {
  assert.ok(idSet.has(row.groupId), `Unknown group ${row.groupId} for ${row.name}.`);
  assert.ok(row.code && row.name, 'Every category must have a stable code and non-empty label.');
}
const uniqueCodes = new Set(rows.map((row) => row.groupId + ':' + row.code));
assert.equal(uniqueCodes.size, rows.length, 'Category codes must be unique within each group.');

for (const groupId of expectedGroups) {
  for (const kind of ['activity', 'profession']) {
    assert.ok(rows.some((row) => row.groupId === groupId && row.kind === kind),
      `Group ${groupId} must include at least one ${kind} category.`);
  }
}
assert.ok(defaults.includes('normalizeCanonicalTaxonomySettings'), 'Saved taxonomy settings must be merged with canonical defaults.');
assert.ok(defaults.includes('LEGACY_GROUP_MAP'), 'Old group IDs must remain readable during migration.');
assert.ok(defaults.includes('BACKEND_CODE_GROUP_MAP'), 'Existing backend category codes must map to canonical groups.');

assert.ok(admin.includes('التصنيف — النشاط أو المهنة'), 'Admin activity form must expose the activity/profession selector.');
assert.ok(admin.includes('التخصص الدقيق (اختياري)'), 'Admin activity form must expose an optional specialty selector.');
assert.ok(admin.includes('categoryClassificationType: matchedCat?.classificationType'), 'Admin-created businesses must retain category classification.');
assert.ok(directory.includes("const [selectedCategoryKind"), 'Public directory must allow activity/profession filtering.');
assert.ok(directory.includes('const availableCategories = categories.filter'), 'Public directory category options must respect selected main group and classification kind.');
assert.ok(directory.includes('التخصص الدقيق'), 'Public directory must allow filtering by an available specialty.');
assert.ok(directory.includes('matchesCategoryKind') && directory.includes('matchesSpecialty'), 'Directory filters must narrow real business records by kind/category/specialty.');
assert.ok(context.includes('activityGroupCode: data.functionalGroupId'), 'The client must send the canonical group to the server.');
assert.ok(context.includes('activityClassificationType: data.categoryClassificationType'), 'The client must send activity/profession type to the server.');
assert.ok(context.includes('activitySpecialty: data.activitySpecialty'), 'The client must send selected specialty to the server.');
assert.ok(production.includes('activity_group_code'), 'Production mapping must read saved canonical group metadata.');

for (const groupId of expectedGroups) {
  assert.ok(backend.includes(`"${groupId}"`), `Server allowlist is missing canonical group ${groupId}.`);
}
assert.ok(backend.includes('INVALID_ACTIVITY_GROUP'), 'Server must reject unsupported group IDs.');
assert.ok(backend.includes('INVALID_ACTIVITY_CLASSIFICATION_TYPE'), 'Server must validate activity/profession classification values.');
assert.ok(backend.includes('activity_group_code: activityGroupCode'), 'Server must persist canonical group metadata.');
assert.ok(backend.includes('activity_classification_type: activityClassificationType'), 'Server must persist classification type.');
assert.ok(backend.includes('activity_specialty: activitySpecialty || null'), 'Server must persist specialty metadata without activating modules.');

console.log(`Canonical taxonomy contract: PASS — ${groups.length} groups, ${rows.length} category entries, activity/profession separation, legacy mapping, admin UI, and server persistence.`);
