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
const publicDirectory = read('supabase/functions/public-catalog-directory/index.ts');
const publicCatalog = read('supabase/functions/public-catalog/index.ts');

const expectedGroups = [
  'medical_health', 'food_grocery', 'fashion_beauty', 'home_maintenance',
  'auto_transport', 'real_estate', 'education_training',
  'technology_communications', 'professional_services', 'agriculture_animals',
];

const groups = Array.from(defaults.matchAll(/makeGroup\('([^']+)'/g), (match) => match[1]);
assert.equal(groups.length, 10, 'Taxonomy must contain exactly 10 canonical groups.');
assert.deepEqual(groups, expectedGroups, 'Canonical group IDs and display order must not drift.');
assert.ok(types.includes("classificationType?: 'activity' | 'profession'"), 'Taxonomy categories must explicitly distinguish activities from professions.');
assert.ok(types.includes('specialties?: string[]'), 'Taxonomy categories must support third-level specialties.');

const rows = Array.from(
  defaults.matchAll(/^\s*s\('([^']+)','([^']+)','(activity|profession)','([^']+)'/gm),
  (match) => ({ groupId: match[1], code: match[2], kind: match[3], name: match[4] }),
);
assert.equal(rows.length, 50, `Expected exactly 50 primary activity categories (5 per group), found ${rows.length}.`);
assert.ok(rows.every((row) => row.kind === 'activity'), 'Professions must be represented as specialties, not peer categories.');

const idSet = new Set(groups);
for (const row of rows) {
  assert.ok(idSet.has(row.groupId), `Unknown group ${row.groupId} for ${row.name}.`);
  assert.ok(row.code && row.name, 'Every category must have a stable code and non-empty label.');
}
const uniqueCodes = new Set(rows.map((row) => row.groupId + ':' + row.code));
assert.equal(uniqueCodes.size, rows.length, 'Category codes must be unique within each group.');

for (const groupId of expectedGroups) {
  assert.equal(rows.filter((row) => row.groupId === groupId).length, 5,
    `Group ${groupId} must contain exactly five primary activities.`);
}
assert.ok(!rows.some((row) => row.name === 'طبيب' || row.code === 'doctor'), 'Doctor must not be a separate category beside medical practices/clinics.');
assert.ok(defaults.includes('normalizeCanonicalTaxonomySettings'), 'Saved taxonomy settings must be merged with canonical defaults.');
assert.ok(defaults.includes('LEGACY_GROUP_MAP'), 'Old group IDs must remain readable during migration.');
assert.ok(defaults.includes('BACKEND_CODE_GROUP_MAP'), 'Existing backend category codes must map to canonical groups.');

assert.ok(admin.includes('النشاط الرئيسي'), 'Admin business form must select a primary activity.');
assert.ok(admin.includes('التخصص الدقيق (اختياري)'), 'Admin activity form must expose an optional specialty selector.');
assert.ok(!admin.includes('option value="profession">مهنة'), 'Admin must not offer standalone profession categories.');
assert.ok(admin.includes('categoryClassificationType: matchedCat?.classificationType'), 'Admin-created businesses must retain category classification.');
assert.ok(directory.includes("const [selectedCategoryKind"), 'Public directory must allow activity/profession filtering.');
assert.ok(directory.includes('const availableCategories = categories.filter'), 'Public directory category options must respect selected main group and classification kind.');
assert.ok(directory.includes('التخصص الدقيق'), 'Public directory must allow filtering by an available specialty.');
assert.ok(directory.includes('matchesCategoryKind') && directory.includes('matchesSpecialty'), 'Directory filters must narrow real business records by kind/category/specialty.');
assert.ok(context.includes('activityGroupCode: data.functionalGroupId'), 'The client must send the canonical group to the server.');
assert.ok(context.includes('activityClassificationType: data.categoryClassificationType'), 'The client must send activity/profession type to the server.');
assert.ok(context.includes('activitySpecialty: data.activitySpecialty'), 'The client must send selected specialty to the server.');
assert.ok(production.includes('raw.activityGroupCode || raw.activity_group_code'), 'Production mapping must read canonical group metadata from the public directory response.');
assert.ok(production.includes('raw.activityClassificationType'), 'Production mapping must preserve activity/profession type from the public directory response.');
assert.ok(production.includes('raw.activitySpecialty'), 'Production mapping must preserve specialty from the public directory response.');
assert.ok(production.includes('raw.settings?.activity_category_code'), 'Production mapping must read the canonical activity category code.');
assert.ok(production.includes('canonicalCategoryId'), 'Production mapping must resolve the stable canonical category ID.');
assert.ok(directory.includes('business.categoryId === category.id'), 'Directory filtering must prefer the canonical category ID.');
assert.ok(directory.includes('المجالات الرئيسية') && directory.includes('تصفح حسب النشاط والتخصص'), 'Public taxonomy navigation must use customer-readable domain/activity labels.');
for (const code of ['medical_practices', 'food_retail', 'home_services', 'digital_marketing', 'animal_production']) {
  assert.ok(defaults.includes(`'${code}'`), `Canonical taxonomy must include the audited activity code ${code}.`);
}

assert.ok(publicDirectory.includes('activityGroupCode: String(business.settings?.activity_group_code'), 'Public directory must return the canonical main group code.');
assert.ok(publicDirectory.includes('activityClassificationType: String(business.settings?.activity_classification_type'), 'Public directory must return the activity/profession type.');
assert.ok(publicDirectory.includes('activitySpecialty: String(business.settings?.activity_specialty'), 'Public directory must return the specialty without exposing all business settings.');
assert.ok(publicDirectory.includes('activityCategoryCode: String(business.settings?.activity_category_code'), 'Public directory must return the safe canonical activity category code.');
assert.ok(publicCatalog.includes('activityCategoryCode: String(business.settings?.activity_category_code'), 'Public storefront must return safe taxonomy metadata for direct page hydration.');

for (const groupId of expectedGroups) {
  assert.ok(backend.includes(`"${groupId}"`), `Server allowlist is missing canonical group ${groupId}.`);
}
assert.ok(backend.includes('INVALID_ACTIVITY_GROUP'), 'Server must reject unsupported group IDs.');
assert.ok(backend.includes('INVALID_ACTIVITY_CLASSIFICATION_TYPE'), 'Server must validate activity/profession classification values.');
assert.ok(backend.includes('activity_group_code: activityGroupCode'), 'Server must persist canonical group metadata.');
assert.ok(backend.includes('activity_classification_type: activityClassificationType'), 'Server must persist classification type.');
assert.ok(backend.includes('activity_specialty: activitySpecialty || null'), 'Server must persist specialty metadata without activating modules.');

const iconMapStart = directory.indexOf('const ICONS_MAP: Record<string, React.ReactNode> = {');
const iconMapEnd = directory.indexOf('\n};', iconMapStart);
assert.ok(iconMapStart >= 0 && iconMapEnd > iconMapStart, 'Public directory must define a dedicated functional-group icon map.');
const iconMap = directory.slice(iconMapStart, iconMapEnd);
const expectedIcons = {
  medical_health: 'Stethoscope',
  food_grocery: 'Utensils',
  fashion_beauty: 'Shirt',
  home_maintenance: 'Wrench',
  auto_transport: 'Car',
  real_estate: 'Building2',
  education_training: 'GraduationCap',
  technology_communications: 'Cpu',
  professional_services: 'BriefcaseBusiness',
  agriculture_animals: 'Sprout',
};
for (const [groupId, iconName] of Object.entries(expectedIcons)) {
  assert.ok(iconMap.includes(`${groupId}: <${iconName} `), `Group ${groupId} must use its designated icon (${iconName}).`);
}
assert.ok(!directory.includes('FUNCTIONAL_GROUP_COVERS'), 'Functional group cards must not regress to background cover images.');
assert.ok(directory.includes('xl:grid-cols-10'), 'Functional group cards should retain ten columns on extra-large screens.');
assert.ok(/bg-white p-(?:1\.5 sm:p-3|3) text-center/.test(directory), 'Functional group cards should use the consistent responsive light icon-card treatment at mobile and larger breakpoints.');
assert.ok(directory.includes('aria-pressed={isSelected}'), 'Functional group selection must remain accessible to assistive technology.');

console.log(`Canonical taxonomy contract: PASS — ${groups.length} groups, ${rows.length} activities (5 per group), specialties, legacy mapping, admin UI, and server persistence.`);
