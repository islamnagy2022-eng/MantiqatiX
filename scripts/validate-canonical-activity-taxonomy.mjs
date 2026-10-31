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
const directoryListings = read('apps/catalog-frontend/src/lib/directoryListings.ts');
const directoryListingsAdmin = read('apps/catalog-frontend/src/components/admin/DirectoryListingsAdmin.tsx');
const directoryListingsView = read('apps/catalog-frontend/src/components/DirectoryListingsView.tsx');
const browserE2E = read('apps/catalog-frontend/tests/professional-dashboard.browser.e2e.mjs');
const directoryView = read('apps/catalog-frontend/src/components/DirectoryView.tsx');
const directoryListingsEdge = read('supabase/functions/directory-listings/index.ts');
const activityModuleRegistry = read('apps/catalog-frontend/src/modules/activities/activityModuleRegistry.ts');

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
assert.ok(defaults.includes('seenNames.has(normalizedName)'), 'Custom taxonomy labels must not duplicate canonical activity names.');
assert.ok(defaults.includes('LEGACY_GROUP_MAP'), 'Old group IDs must remain readable during migration.');
assert.ok(defaults.includes('BACKEND_CODE_GROUP_MAP'), 'Existing backend category codes must map to canonical groups.');
assert.ok(defaults.includes('LEGACY_DIRECTORY_CATEGORY_MAP'), 'Legacy directory category IDs must resolve to canonical category IDs.');
assert.ok(defaults.includes('resolveCanonicalDirectoryCategoryId'), 'Directory listing category IDs must normalize at the read boundary.');
assert.ok(defaults.includes('resolveCanonicalActivityCategoryId'), 'Legacy business activity codes must resolve to canonical category IDs.');
assert.ok(defaults.includes('export function resolveCanonicalSpecialty'), 'Legacy specialty values must resolve to canonical specialty keys.');
assert.ok(directoryView.includes('resolveCanonicalSpecialty'), 'Registered businesses and unconfirmed directory listings must share canonical specialty matching.');
assert.ok(directoryListingsView.includes('resolveCanonicalSpecialty'), 'Directory detail filtering must use the shared canonical specialty resolver.');
for (const legacySpecialty of ['الانشطه المعماريه والتصميم الداخلي والديكورات', 'بيع وتركيب وصيانه الادوات الصحيه والفلاتر وانظمه تنقيه المياه', 'مستحضرات التجميل والعنايه بالشعر والبشره', 'التسويق الرقمي واداره الحملات والمحتوى والتصميم']) {
  assert.ok(defaults.includes(legacySpecialty), `Missing legacy business specialty mapping for ${legacySpecialty}.`);
}
const observedLegacyGroups = [
  'agriculture_animals','auto_transport','construction_decor','education_training',
  'fashion_beauty','finance_insurance','food_grocery','home_maintenance',
  'industry_workshops','marketing_media','medical_health','professional_services',
  'public_community','real_estate','sports_fitness','technology_communications',
  'tourism_events','trade_ecommerce',
];
for (const legacyGroupId of observedLegacyGroups) {
  assert.ok(defaults.includes(`${legacyGroupId}:`), `Missing legacy group compatibility for ${legacyGroupId}.`);
}

const observedLegacyCategoryIds = [
  'cat_agriculture_animals_agri_supplies','cat_agriculture_animals_animal_feed','cat_agriculture_animals_veterinary_clinics',
  'cat_auto_transport_auto_maintenance','cat_auto_transport_auto_parts',
  'cat_construction_decor_aluminum_glass','cat_construction_decor_building_materials','cat_construction_decor_contractors','cat_construction_decor_finishing_companies',
  'cat_education_training_nurseries','cat_education_training_schools','cat_education_training_tutoring_centers','cat_education_training_vocational_training',
  'cat_fashion_beauty_beauty_centers','cat_fashion_beauty_beauty_products','cat_fashion_beauty_clothing_stores','cat_fashion_beauty_jewelry_stores','cat_fashion_beauty_salons','cat_fashion_beauty_shoes_bags',
  'cat_finance_insurance_banks','cat_finance_insurance_insurance_companies',
  'cat_food_grocery_bakeries','cat_food_grocery_cafes','cat_food_grocery_food_suppliers','cat_food_grocery_fresh_food','cat_food_grocery_restaurants','cat_food_grocery_specialty_food','cat_food_grocery_supermarkets','cat_food_grocery_sweets',
  'cat_home_maintenance_furniture','cat_home_maintenance_home_appliances','cat_home_maintenance_home_textiles','cat_home_maintenance_homewares','cat_home_maintenance_pest_control',
  'cat_industry_workshops_food_factories','cat_industry_workshops_garment_factories','cat_industry_workshops_metal_workshops',
  'cat_marketing_media_ad_services','cat_marketing_media_marketing_agencies','cat_marketing_media_photo_video',
  'cat_medical_health_clinics','cat_medical_health_dental_centers','cat_medical_health_dentist','cat_medical_health_doctor','cat_medical_health_hospitals','cat_medical_health_labs','cat_medical_health_medical_centers','cat_medical_health_pharmacies','cat_medical_health_physio_centers','cat_medical_health_physiotherapist','cat_medical_health_radiology_specialist',
  'cat_professional_services_accounting_offices','cat_professional_services_law_offices',
  'cat_public_community_government_services','cat_public_community_office_services','cat_public_community_social_organizations',
  'cat_real_estate_real_estate_agent','cat_sports_fitness_gyms','cat_sports_fitness_sports_fields',
  'cat_technology_communications_computer_repair','cat_technology_communications_telecom_retail',
  'cat_tourism_events_event_halls','cat_tourism_events_travel_agencies','cat_trade_ecommerce_stationery_books',
  'cat_construction_decor_interior_design','cat_construction_decor_sanitary_ware','cat_industry_workshops_plastic_factories',
];
assert.equal(observedLegacyCategoryIds.length, 67, 'The live legacy inventory contract must cover all 67 distinct category/activity IDs.');
for (const legacyId of observedLegacyCategoryIds) {
  assert.ok(defaults.includes(`${legacyId}:`), `Missing compatibility mapping for ${legacyId}.`);
}

const legacyCategoryMapStart = defaults.indexOf('const LEGACY_DIRECTORY_CATEGORY_MAP: Record<string, string> = {');
const legacyCategoryMapEnd = defaults.indexOf('\n};', legacyCategoryMapStart);
assert.ok(legacyCategoryMapStart >= 0 && legacyCategoryMapEnd > legacyCategoryMapStart, 'Legacy directory category map must be a parseable explicit map.');
const legacyCategoryMapSource = defaults.slice(legacyCategoryMapStart, legacyCategoryMapEnd);
const legacyCategoryMappings = new Map(
  Array.from(legacyCategoryMapSource.matchAll(/^\s*(cat_[a-z0-9_]+):\s*'(cat_[a-z0-9_]+)'/gm),
    (match) => [match[1], match[2]]),
);
const canonicalCategoryIds = new Set(rows.map((row) => 'cat_' + row.groupId + '_' + row.code));
assert.equal(legacyCategoryMappings.size, 67, 'The compatibility map must contain all 67 audited legacy directory category IDs.');
for (const legacyId of observedLegacyCategoryIds) {
  const targetId = legacyCategoryMappings.get(legacyId);
  assert.ok(targetId, 'Legacy directory category ' + legacyId + ' must have an explicit target.');
  assert.ok(canonicalCategoryIds.has(targetId), 'Legacy directory category ' + legacyId + ' maps to non-canonical category ' + targetId + '.');
  const targetGroup = expectedGroups.find((groupId) => targetId.startsWith('cat_' + groupId + '_'));
  assert.ok(targetGroup, 'Legacy directory category ' + legacyId + ' maps outside the ten canonical groups: ' + targetId + '.');
}
const legacyGroupMapStart = defaults.indexOf('const LEGACY_GROUP_MAP:');
const legacyGroupMapEnd = defaults.indexOf('\n};', legacyGroupMapStart);
assert.ok(legacyGroupMapStart >= 0 && legacyGroupMapEnd > legacyGroupMapStart, 'Legacy group map must be explicit.');
const legacyGroupMappings = new Map(
  Array.from(defaults.slice(legacyGroupMapStart, legacyGroupMapEnd).matchAll(/([a-z0-9_]+):\s*'([a-z0-9_]+)'/g),
    (match) => [match[1], match[2]]),
);
const legacyGroupsInInventory = [...new Set(observedLegacyCategoryIds.map((legacyId) => {
  const groupId = observedLegacyGroups.find((candidate) => legacyId.startsWith('cat_' + candidate + '_'));
  assert.ok(groupId, 'Could not infer legacy group from category ID ' + legacyId + '.');
  return groupId;
}))];
for (const legacyGroup of legacyGroupsInInventory) {
  assert.ok(expectedGroups.includes(legacyGroupMappings.get(legacyGroup)), 'Legacy group ' + legacyGroup + ' must map into the canonical ten.');
}
assert.ok(directoryListings.includes('normalizeDirectoryListingTaxonomy'), 'Public and admin directory listing reads must normalize legacy taxonomy IDs.');
assert.ok(directoryListings.includes('resolveCanonicalDirectoryCategoryId'), 'Directory listing normalization must map legacy category IDs.');
assert.ok(directoryListingsView.includes('resolveCanonicalSpecialty'), 'Legacy specialty labels must match canonical specialty filters through the shared resolver.');
assert.ok(browserE2E.includes("name: 'ممارسات وعيادات طبية', exact: true"), 'Browser taxonomy navigation must assert the canonical medical activity label.');
assert.ok(browserE2E.includes("getByRole('button', { name: /باطنة/ })"), 'Browser taxonomy navigation must assert a canonical medical specialty.');
assert.ok(browserE2E.includes('homepage-activity-counts-follow-canonical-codes-over-conflicting-legacy-labels'), 'Browser E2E must prove that canonical activity codes control homepage category counts when legacy labels conflict.');
assert.ok(!browserE2E.includes("getByText('عيادات عامة', { exact: true })"), 'Legacy clinic category labels must not remain in browser assertions.');
for (const legacySpecialty of ['طبيب اطفال', 'طبيب نساء وتوليد', 'طبيب باطنه', 'مراكز وعيادات اسنان', 'معامل تحاليل', 'علاج طبيعي']) {
  assert.ok(defaults.includes(legacySpecialty), `Missing specialty compatibility alias for ${legacySpecialty}.`);
}
assert.ok(defaults.includes('غدد صماء وسكر') && defaults.includes('جراحة تجميل') && defaults.includes('صدر وحساسية'), 'Medical specialty coverage must include observed live specializations without creating peer activity categories.');
assert.ok(defaults.includes('أثاث وتجهيزات المنزل') && defaults.includes('أجهزة منزلية') && defaults.includes('أدوات منزلية'), 'Homeware and appliance legacy records must resolve to selectable home-equipment specialties.');
assert.ok(directoryListingsAdmin.includes('cat_medical_health_medical_practices'), 'New directory entries must default to the canonical medical activity category.');
assert.ok(directoryListingsAdmin.includes('canonicalSpecialtyLabel'), 'Editing legacy directory rows must resolve their old specialty into a selectable canonical label.');
assert.ok(directoryListingsAdmin.includes('resolveCanonicalSpecialty(candidate, categoryId)'), 'The admin edit form must share the canonical specialty resolver.');
assert.ok(browserE2E.includes('platformAdmin: {'), 'Browser E2E must include an explicit platform-admin identity for directory management.');
assert.ok(browserE2E.includes('platform-admin-directory-legacy-specialty-edit-and-new-listing-save-round-trip'), 'Browser E2E must cover both edit and create save round trips for directory listings.');
assert.ok(browserE2E.includes('non-platform-role-denied-directory-admin-route'), 'Browser E2E must verify that non-platform roles cannot load the directory admin UI or bundle.');
assert.ok(browserE2E.includes('directoryAdminRequests'), 'Directory admin E2E must inspect the actual request payload and bearer authorization contract.');
assert.ok(directoryListingsEdge.includes('TAXONOMY_GROUP_MISMATCH'), 'The directory Edge Function must reject category/group mismatches.');
assert.ok(directoryListingsEdge.includes('PHONE_REQUIRED_FOR_PUBLICATION'), 'The directory Edge Function must keep the phone requirement for published listings.');
assert.ok(directoryListingsEdge.includes('const validGroups = new Set(["medical_health","food_grocery","fashion_beauty","home_maintenance","auto_transport","real_estate","education_training","technology_communications","professional_services","agriculture_animals"])'), 'Directory listing writes must accept only canonical group IDs.');

assert.ok(admin.includes('النشاط الرئيسي'), 'Admin business form must select a primary activity.');
assert.ok(admin.includes('التخصص الدقيق (اختياري)'), 'Admin activity form must expose an optional specialty selector.');
assert.ok(!admin.includes('option value="profession">مهنة'), 'Admin must not offer standalone profession categories.');
assert.ok(admin.includes('categoryClassificationType: matchedCat?.classificationType'), 'Admin-created businesses must retain category classification.');
const activityModuleView = read('apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx');
assert.ok(directory.includes("new URLSearchParams(window.location.search).get('activity')"), 'Each activity module must have a refreshable direct URL.');
assert.ok(directory.includes("const availableCategories = categories.filter((category) => (category.classificationType || 'activity') === 'activity');"), 'Visitor discovery must expose activities directly and omit standalone profession categories.');
assert.ok(directory.includes('openActivityModule(category.id)'), 'Clicking an activity must open its dedicated module page.');
assert.ok(directory.includes('setSelectedCategoryId(activityCategory.id)') && directory.includes('setSelectedSpecialty(specialty)'), 'Choosing a specialty must return to the directory with the activity/specialty filter.');
assert.ok(!directory.includes('functionalGroups') && !directory.includes('selectedGroupFilter') && !directory.includes('matchesCategoryKind'), 'Functional-group navigation/filtering must not appear in public directory UI logic.');
assert.ok(activityModuleView.includes("type Section = 'overview' | 'specialties' | 'marketing' | 'operations'"), 'Activity module must provide its own domain workspace sections.');
assert.ok(activityModuleView.includes('resolveActivityModuleConfig(category, adminSettings.activityModuleOverrides)'), 'Every activity page must resolve its dedicated module configuration with persisted Super Admin overrides keyed by canonical activity identity.');
assert.ok(activityModuleView.includes('marketing.contentPillars') && activityModuleView.includes('marketing.campaignIdeas') && activityModuleView.includes('marketing.requiredAssets'), 'Activity marketing page must render domain-specific content pillars, campaign ideas and required assets.');
assert.ok(activityModuleView.includes('moduleConfig.capabilities.map'), 'Activity operations page must render capabilities from its activity module configuration.');
assert.ok(activityModuleRegistry.includes('activityId: category.id') && activityModuleRegistry.includes('activityName: name'), 'Module registry must key each resolved module by the stable canonical activity ID.');
assert.ok(activityModuleRegistry.includes('ACTIVITY_SPECIFIC_OVERRIDES'), 'Activity registry must include explicit reviewed per-activity overrides.');
const canonicalActivityIds = Array.from(defaults.matchAll(/s\('([^']+)','([^']+)'/g), (match) => 'cat_' + match[1] + '_' + match[2]);
assert.equal(canonicalActivityIds.length, 50, 'The canonical activity seed must contain the expected 50 activity categories.');
for (const activityId of canonicalActivityIds) {
  assert.ok(activityModuleRegistry.includes(activityId + ':'), 'Missing explicit activity module override for ' + activityId + '.');
}
assert.ok(activityModuleRegistry.includes('ACTIVITY_CAPABILITY_OVERRIDES'), 'Every activity must resolve an activity-specific operational capability set.');
const activityCapabilityRegistry = activityModuleRegistry.slice(activityModuleRegistry.indexOf('export const ACTIVITY_CAPABILITY_OVERRIDES'));
const activityCapabilityLines = activityCapabilityRegistry.split(String.fromCharCode(10));
for (const activityId of canonicalActivityIds) {
  const capabilityLine = activityCapabilityLines.find((line) => line.startsWith('  ' + activityId + ': ['));
  assert.ok(capabilityLine, 'Missing activity-specific capability definitions for ' + activityId + '.');
  assert.equal(capabilityLine.split('{ id:').length - 1, 3, 'Each activity must define exactly three reviewed operational capabilities: ' + activityId + '.');
}
assert.ok(activityModuleRegistry.includes("state: 'planned' as const"), 'Activity-specific capabilities must default to planned until backed by authorized workflows.');
assert.ok(activityModuleRegistry.includes("ACTIVITY_CAPABILITY_OVERRIDES[category.id] || profile.capabilities"), 'Activity resolver must prefer activity-specific capability definitions.');
assert.ok(activityModuleRegistry.includes('operationalFocus: override?.operationalFocus'), 'Activity modules must expose an activity-specific operating scope.');

assert.ok(activityModuleRegistry.includes('type DomainProfile') && activityModuleRegistry.includes('domainProfiles:'), 'Module registry must provide typed domain profiles.');
assert.ok(activityModuleRegistry.includes('campaignIdeas:') && activityModuleRegistry.includes('requiredAssets:') && activityModuleRegistry.includes('contentPillars:'), 'Each domain profile must define campaign ideas, required assets and content pillars.');
assert.ok(activityModuleRegistry.includes("state: 'planned'"), 'Unintegrated operating capabilities must be visibly marked planned rather than falsely active.');
assert.ok(!activityModuleRegistry.includes("state: 'available'"), 'No domain operation may be marked available before its server contract and authorization are implemented.');
assert.ok(activityModuleView.includes('onSelectSpecialty(specialty)'), 'Activity module specialty selection must connect back to the directory.');
assert.ok(directory.includes('matchesSpecialty'), 'Directory results must still filter real business records by the selected specialty.');
assert.ok(context.includes('activityGroupCode: data.functionalGroupId'), 'The client must send the canonical group to the server.');
assert.ok(context.includes('activityClassificationType: data.categoryClassificationType'), 'The client must send activity/profession type to the server.');
assert.ok(context.includes('activitySpecialty: data.activitySpecialty'), 'The client must send selected specialty to the server.');
assert.ok(production.includes('raw.activityGroupCode || raw.activity_group_code'), 'Production mapping must read canonical group metadata from the public directory response.');
assert.ok(production.includes('raw.activityClassificationType'), 'Production mapping must preserve activity/profession type from the public directory response.');
assert.ok(production.includes('raw.activitySpecialty'), 'Production mapping must preserve specialty from the public directory response.');
assert.ok(production.includes('raw.settings?.activity_category_code'), 'Production mapping must read the canonical activity category code.');
assert.ok(production.includes('canonicalCategoryId'), 'Production mapping must resolve the stable canonical category ID.');
assert.ok(production.includes('resolveCanonicalActivityCategoryId(activityGroupCode, activityCategoryCode)'), 'Business mapping must resolve legacy activity codes to canonical category IDs.');
const mappedCategoryIdExpression = production.match(/categoryId:\s*([\s\S]*?),\n\s*functionalGroupId:/)?.[1] || '';
assert.ok(mappedCategoryIdExpression.includes('canonicalCategoryId'), 'Business mapping must prefer the stable canonical activity ID.');
assert.ok(
  mappedCategoryIdExpression.indexOf('canonicalCategoryId') < mappedCategoryIdExpression.indexOf('x.name === category'),
  'Legacy display/category labels must only be a fallback when no canonical activity code resolves.',
);
assert.ok(production.includes('activityGroupCode: body.business?.activityGroupCode'), 'Direct storefront hydration must pass the safe canonical group code into business mapping.');
assert.ok(production.includes('activityCategoryCode: body.business?.activityCategoryCode'), 'Direct storefront hydration must pass the safe canonical category code into business mapping.');
assert.ok(production.includes('meta.activity_group_code') && production.includes('meta.activity_category_code'), 'Business mapping must read taxonomy metadata from the safe bizcatalog profile where present.');
assert.ok(directory.includes('business.categoryId === category.id'), 'Directory filtering must prefer the canonical category ID.');
assert.ok(directory.includes('aria-label="الأنشطة"') && activityModuleView.includes('وحدة النشاط'), 'Public navigation must expose direct activities and dedicated activity modules.');
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
assert.ok(directory.includes('xl:grid-cols-5'), 'Direct activity cards must use a responsive multi-column layout.');
assert.ok(directory.includes('openActivityModule(category.id)'), 'Activity cards must navigate to the activity module route.');
assert.ok(directory.includes('تصفية النتائج حسب:') && directory.includes('عرض كل الأنشطة'), 'Specialty filters must remain visible and reversible after returning to the directory.');
assert.ok(!directory.includes('functionalGroups'), 'Functional groups must not be displayed or filtered in the public directory.');


console.log(`Canonical taxonomy contract: PASS — ${groups.length} groups, ${rows.length} activities (5 per group), specialties, legacy mapping, admin UI, and server persistence.`);
