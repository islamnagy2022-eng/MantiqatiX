#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const taxonomy = read('apps/catalog-frontend/src/data/productionDefaults.ts');
const geo = read('apps/catalog-frontend/src/data/egyptGeoDiscovery.ts');
const csv = read('apps/catalog-frontend/public/templates/menoufia-activity-intake-template.csv');
const admin = read('apps/catalog-frontend/src/components/admin/DirectoryListingsAdmin.tsx');
const activityModule = read('apps/catalog-frontend/src/modules/activities/ActivityModuleView.tsx');
const directory = read('apps/catalog-frontend/src/components/DirectoryView.tsx');

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  assert.equal(quoted, false, 'CSV rows must not contain an unterminated quoted field.');
  fields.push(value);
  return fields;
}

const groupNames = new Map(
  [...taxonomy.matchAll(/makeGroup\('([^']+)','([^']+)'/g)].map((match) => [match[1], match[2]]),
);
const categories = [];
for (const line of taxonomy.split('\n')) {
  const match = line.match(/^\s*s\('([^']+)','([^']+)','activity','([^']+)','[^']*',(\[[^\]]*\])\),?$/);
  if (!match) continue;
  categories.push({
    groupId: match[1],
    groupName: groupNames.get(match[1]),
    categoryId: 'cat_' + match[1] + '_' + match[2],
    categoryName: match[3],
    specialties: [...match[4].matchAll(/'([^']*)'/g)].map((entry) => entry[1]),
  });
}

const districtDeclaration = geo.indexOf('export const EGYPT_GEO_DISTRICTS');
const districtAssignment = geo.indexOf('=', districtDeclaration);
const districtArrayStart = geo.indexOf('[', districtAssignment);
const districtArrayEnd = geo.indexOf('];', districtArrayStart);
assert.ok(districtDeclaration >= 0 && districtAssignment > districtDeclaration && districtArrayStart > districtAssignment && districtArrayEnd > districtArrayStart,
  'Canonical Egypt district dataset must remain parseable.');
const menoufiaDistricts = JSON.parse(geo.slice(districtArrayStart, districtArrayEnd + 1))
  .filter((district) => district.governorateId === 'EG17');

const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
const headers = parseCsvLine(lines[0]);
const expectedHeaders = [
  'governorate_id','governorate','district_id','district','functional_group_id','functional_group',
  'activity_category_id','activity_category','specialty_options','entity_name','listing_type',
  'selected_specialty','phone','secondary_phone','address','village','source_name','source_url',
  'source_checked_at','permission_basis','permission_evidence_reference','owner_submission_consent',
  'contact_public_consent','listing_status','verification_status',
];
assert.deepEqual(headers, expectedHeaders, 'Intake template columns and order must stay stable.');
assert.equal(groupNames.size, 10, 'The template must retain the ten canonical functional groups.');
assert.equal(categories.length, 50, 'The template must contain all 50 canonical activity categories.');
assert.equal(menoufiaDistricts.length, 12, 'The template must cover the 12 canonical Menoufia district/city records.');
assert.equal(lines.length - 1, categories.length * menoufiaDistricts.length,
  'There must be one blank intake row per activity category and Menoufia district.');

const rows = lines.slice(1).map(parseCsvLine);
const categoryById = new Map(categories.map((category) => [category.categoryId, category]));
const districtById = new Map(menoufiaDistricts.map((district) => [district.id, district]));
const seen = new Set();
const perCategory = new Map();
const perDistrict = new Map();
const blankDataColumns = [
  'entity_name','listing_type','selected_specialty','phone','secondary_phone','address','village',
  'source_name','source_url','source_checked_at','permission_basis','permission_evidence_reference',
];
for (const values of rows) {
  assert.equal(values.length, headers.length, 'Every intake row must have the same number of columns as the header.');
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  const category = categoryById.get(row.activity_category_id);
  const district = districtById.get(row.district_id);
  assert.ok(category, 'Every template row must reference a canonical activity category.');
  assert.ok(district, 'Every template row must reference a canonical Menoufia district.');
  assert.equal(row.governorate_id, 'EG17');
  assert.equal(row.governorate, 'المنوفية');
  assert.equal(row.district, district.name);
  assert.equal(row.functional_group_id, category.groupId);
  assert.equal(row.functional_group, category.groupName);
  assert.equal(row.activity_category, category.categoryName);
  assert.equal(row.specialty_options, category.specialties.join(' | '));
  assert.equal(row.owner_submission_consent, 'NOT_GIVEN');
  assert.equal(row.contact_public_consent, 'NOT_GIVEN');
  assert.equal(row.listing_status, 'DRAFT');
  assert.equal(row.verification_status, 'UNVERIFIED');
  for (const column of blankDataColumns) {
    assert.equal(row[column], '', 'The template must not invent business, contact, or source data: ' + column);
  }
  const key = row.activity_category_id + ':' + row.district_id;
  assert.ok(!seen.has(key), 'Duplicate activity/district template row: ' + key);
  seen.add(key);
  perCategory.set(row.activity_category_id, (perCategory.get(row.activity_category_id) || 0) + 1);
  perDistrict.set(row.district_id, (perDistrict.get(row.district_id) || 0) + 1);
}
assert.equal(seen.size, 600, 'All 600 activity/district combinations must be unique.');
assert.ok([...perCategory.values()].every((count) => count === 12), 'Every activity must cover all 12 Menoufia districts.');
assert.ok([...perDistrict.values()].every((count) => count === 50), 'Every Menoufia district must contain all 50 activity categories.');

assert.ok(admin.includes('MENOUFIA_GOVERNORATE_NAME'), 'New admin directory forms must default to Menoufia.');
assert.ok(admin.includes('EGYPT_GEO_DISTRICTS.filter((district) => district.governorateName === form.governorate)'),
  'Admin district selector must use the canonical governorate/district hierarchy.');
assert.ok(admin.includes('templates/menoufia-activity-intake-template.csv'), 'The admin directory panel must expose the blank intake template.');
assert.ok(admin.includes('مسودة غير موثقة'), 'The admin form must clearly explain draft/unverified status.');
assert.ok(activityModule.includes('activity-geographic-scope') && activityModule.includes('activityGovernorate'),
  'An activity page must visibly retain its validated governorate scope.');
assert.ok(activityModule.includes('activity-empty-directory-state'),
  'Empty category pages must explain that no business records are available rather than fabricate a listing.');
assert.ok(directory.includes('const PUBLIC_UNCLAIMED_DIRECTORY_LISTINGS_ENABLED = false'),
  'The unclaimed public directory release gate must remain disabled.');
assert.ok(directory.includes('if (!PUBLIC_UNCLAIMED_DIRECTORY_LISTINGS_ENABLED)'),
  'The directory UI must preserve its closed release gate.');

console.log('MENOUFIA_ACTIVITY_INTAKE_TEMPLATE=PASS');
console.log('CANONICAL_GROUPS=10; ACTIVITIES=50; DISTRICTS=12; BLANK_INTAKE_ROWS=' + rows.length);
console.log('RECORDS_FABRICATED=NO; PUBLIC_CONSENT=NOT_GIVEN; STATUS=DRAFT; VERIFICATION=UNVERIFIED');
