import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MONUFIA_OSM_RELATION_ID,
  SOURCE_LICENSE,
  prepareMonufiaCandidates,
  classifyOsmTags,
} from '../prepare-monufia-osm-candidates.mjs';

const boundary = {
  type: 'relation',
  id: MONUFIA_OSM_RELATION_ID,
  tags: {
    boundary: 'administrative',
    admin_level: '4',
    name: 'Al Minufiyah',
    'name:ar': 'المنوفية',
  },
};

const fixture = () => ({
  elements: [
    boundary,
    { type: 'node', id: 101, lat: 30.55, lon: 31.01, tags: { amenity: 'restaurant', name: 'مطعم اختبار', phone: '+201000000000', website: 'https://private.example' } },
    { type: 'way', id: 102, center: { lat: 30.51, lon: 30.99 }, tags: { amenity: 'pharmacy', name: 'صيدلية اختبار' } },
    { type: 'node', id: 103, lat: 30.50, lon: 31.02, tags: { shop: 'supermarket', name: 'سوبر ماركت اختبار' } },
    { type: 'node', id: 104, lat: 30.49, lon: 31.03, tags: { office: 'unknown_professional', name: 'مكتب يحتاج تصنيف' } },
    { type: 'node', id: 105, lat: 30.48, lon: 31.04, tags: { amenity: 'parking', name: 'موقف سيارات' } },
    { type: 'node', id: 106, lat: 30.47, lon: 31.05, tags: { shop: 'bakery' } },
    { type: 'node', id: 107, lat: 30.46, lon: 31.06, tags: { shop: 'clothes', name: 'متجر ملابس', phone: '01000000000' } },
    { type: 'node', id: 107, lat: 30.46, lon: 31.06, tags: { shop: 'clothes', name: 'متجر ملابس مكرر' } },
  ],
});

test('requires the exact Monufia administrative relation and rejects lookalikes', () => {
  const result = prepareMonufiaCandidates(fixture(), { snapshotAt: '2026-11-27T00:00:00.000Z' });
  assert.equal(result.manifest.boundary.id, 3824207);
  assert.equal(result.manifest.boundary.name, 'المنوفية');
  const wrong = fixture();
  wrong.elements[0] = { ...boundary, id: 999, tags: { ...boundary.tags } };
  assert.throws(() => prepareMonufiaCandidates(wrong), /expected Monufia administrative relation/);
  const lookalike = fixture();
  lookalike.elements[0] = { ...boundary, tags: { boundary: 'administrative', name: 'Alexandria' } };
  assert.throws(() => prepareMonufiaCandidates(lookalike), /do not identify Monufia/);
});

test('maps OSM shop and amenity tags to canonical MantiqatiX category IDs', () => {
  const result = prepareMonufiaCandidates(fixture(), { snapshotAt: '2026-11-27T00:00:00.000Z' });
  const restaurant = result.candidates.find((row) => row.source_id === 'osm:node:101');
  const pharmacy = result.candidates.find((row) => row.source_id === 'osm:way:102');
  const grocery = result.candidates.find((row) => row.source_id === 'osm:node:103');
  assert.equal(restaurant.activity_category_id, 'cat_food_grocery_restaurants');
  assert.equal(pharmacy.activity_category_id, 'cat_medical_health_pharmacies');
  assert.equal(grocery.activity_category_id, 'cat_food_grocery_food_retail');
  assert.ok(Object.keys(result.manifest.counts_by_group).includes('food_grocery'));
  assert.ok(Object.keys(result.manifest.counts_by_group).includes('medical_health'));
});

test('unmapped commercial classifications go to a review queue rather than being misclassified', () => {
  const result = prepareMonufiaCandidates(fixture(), { snapshotAt: '2026-11-27T00:00:00.000Z' });
  assert.equal(result.needs_review.length, 1);
  assert.equal(result.needs_review[0].source_id, 'osm:node:104');
  assert.equal(result.needs_review[0].activity_category_id, null);
  assert.equal(result.needs_review[0].taxonomy_review_required, true);
});

test('all exported records are unverified drafts and contact fields are omitted', () => {
  const result = prepareMonufiaCandidates(fixture(), { snapshotAt: '2026-11-27T00:00:00.000Z' });
  const all = [...result.candidates, ...result.needs_review];
  assert.ok(all.length > 0);
  for (const record of all) {
    assert.equal(record.verification_status, 'UNVERIFIED');
    assert.equal(record.publication_status, 'DRAFT');
    assert.equal(record.claim_status, 'UNCLAIMED');
    assert.equal(record.is_verified, false);
    assert.equal(record.public_enabled, false);
    assert.equal(record.publishable, false);
    assert.equal(record.requires_owner_confirmation, true);
    assert.equal(Object.hasOwn(record, 'phone'), false);
    assert.equal(Object.hasOwn(record, 'email'), false);
    assert.equal(Object.hasOwn(record, 'website'), false);
    assert.equal(Object.hasOwn(record, 'ownerWhatsApp'), false);
    assert.equal(Object.hasOwn(record, 'address'), false);
    assert.equal(record.source_license, SOURCE_LICENSE);
    assert.match(record.source_url, /^https:\/\/www\.openstreetmap\.org\/(node|way|relation)\//);
  }
});

test('generic company and estate-agent tags are not forced into an inaccurate category', () => {
  const company = classifyOsmTags({ office: 'company' });
  const estateAgent = classifyOsmTags({ office: 'estate_agent' });
  assert.equal(company.groupId, null);
  assert.equal(company.code, null);
  assert.equal(company.taxonomyReviewRequired, true);
  assert.equal(estateAgent.groupId, null);
  assert.equal(estateAgent.code, null);
  assert.equal(estateAgent.taxonomyReviewRequired, true);
});

test('unknown shop types use the general-retail category but stay flagged for specialty review', () => {
  const classified = classifyOsmTags({ shop: 'mobile_phone' });
  assert.equal(classified.groupId, 'fashion_beauty');
  assert.equal(classified.code, 'general_retail');
  assert.equal(classified.taxonomyReviewRequired, true);
});

test('ignores unnamed, non-commercial, invalid-coordinate and duplicate objects', () => {
  const result = prepareMonufiaCandidates(fixture(), { snapshotAt: '2026-11-27T00:00:00.000Z' });
  assert.equal(result.candidates.some((row) => row.source_id === 'osm:node:105'), false);
  assert.equal(result.candidates.some((row) => row.source_id === 'osm:node:106'), false);
  assert.equal(result.candidates.filter((row) => row.source_id === 'osm:node:107').length, 1);
  assert.ok(result.manifest.ignored_element_count >= 3);
});

test('fails closed on malformed or oversized Overpass responses', () => {
  assert.throws(() => prepareMonufiaCandidates({ elements: {} }), /expected an elements array/);
  assert.throws(() => prepareMonufiaCandidates({ elements: [boundary, ...Array(50001).fill({ type: 'node', id: 1 })] }), /safe input cap/);
});
