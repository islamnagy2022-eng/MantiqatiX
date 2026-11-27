#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MONUFIA_OSM_RELATION_ID = 3824207;
export const SOURCE_LICENSE = 'ODbL-1.0';
export const SOURCE_ATTRIBUTION = '© OpenStreetMap contributors';
export const SOURCE_LICENSE_URL = 'https://opendatacommons.org/licenses/odbl/1-0/';

const MAX_INPUT_ELEMENTS = 50000;
const MAX_OUTPUT_RECORDS = 30000;
const COMMERCIAL_KEYS = ['shop', 'office', 'craft', 'healthcare', 'amenity', 'tourism', 'leisure'];

const EXACT_RULES = [
  { key:'amenity', value:'hospital', groupId:'medical_health', code:'hospitals', specialty:'مستشفى عام' },
  { key:'healthcare', value:'hospital', groupId:'medical_health', code:'hospitals', specialty:'مستشفى عام' },
  { key:'amenity', value:'pharmacy', groupId:'medical_health', code:'pharmacies', specialty:'صيدلية عامة' },
  { key:'shop', value:'pharmacy', groupId:'medical_health', code:'pharmacies', specialty:'صيدلية عامة' },
  { key:'amenity', value:'doctors', groupId:'medical_health', code:'medical_practices', specialty:'ممارسة طبية' },
  { key:'amenity', value:'clinic', groupId:'medical_health', code:'medical_practices', specialty:'عيادة' },
  { key:'amenity', value:'dentist', groupId:'medical_health', code:'medical_practices', specialty:'عيادة أسنان' },
  { key:'healthcare', value:'doctor', groupId:'medical_health', code:'medical_practices', specialty:'ممارسة طبية' },
  { key:'healthcare', value:'clinic', groupId:'medical_health', code:'medical_practices', specialty:'عيادة' },
  { key:'healthcare', value:'dentist', groupId:'medical_health', code:'medical_practices', specialty:'عيادة أسنان' },
  { key:'amenity', value:'laboratory', groupId:'medical_health', code:'diagnostic_labs', specialty:'معمل تحاليل' },
  { key:'healthcare', value:'laboratory', groupId:'medical_health', code:'diagnostic_labs', specialty:'معمل تحاليل' },
  { key:'healthcare', value:'physiotherapist', groupId:'medical_health', code:'rehabilitation', specialty:'علاج طبيعي وتأهيل' },
  { key:'amenity', value:'restaurant', groupId:'food_grocery', code:'restaurants', specialty:'مطعم' },
  { key:'amenity', value:'fast_food', groupId:'food_grocery', code:'restaurants', specialty:'وجبات سريعة' },
  { key:'amenity', value:'food_court', groupId:'food_grocery', code:'restaurants', specialty:'مطاعم' },
  { key:'amenity', value:'cafe', groupId:'food_grocery', code:'cafes', specialty:'مقهى' },
  { key:'amenity', value:'juice_bar', groupId:'food_grocery', code:'cafes', specialty:'عصائر ومشروبات' },
  { key:'shop', value:'coffee', groupId:'food_grocery', code:'cafes', specialty:'قهوة ومشروبات' },
  { key:'shop', value:'bakery', groupId:'food_grocery', code:'bakeries_sweets', specialty:'مخبز' },
  { key:'shop', value:'pastry', groupId:'food_grocery', code:'bakeries_sweets', specialty:'مخبوزات وحلويات' },
  { key:'shop', value:'confectionery', groupId:'food_grocery', code:'bakeries_sweets', specialty:'حلويات' },
  { key:'shop', value:'supermarket', groupId:'food_grocery', code:'food_retail', specialty:'سوبر ماركت' },
  { key:'shop', value:'convenience', groupId:'food_grocery', code:'food_retail', specialty:'بقالة' },
  { key:'shop', value:'grocery', groupId:'food_grocery', code:'food_retail', specialty:'متجر أغذية' },
  { key:'shop', value:'greengrocer', groupId:'food_grocery', code:'food_retail', specialty:'خضروات وفاكهة' },
  { key:'shop', value:'butcher', groupId:'food_grocery', code:'food_retail', specialty:'جزارة' },
  { key:'shop', value:'seafood', groupId:'food_grocery', code:'food_retail', specialty:'أسماك ومأكولات بحرية' },
  { key:'shop', value:'deli', groupId:'food_grocery', code:'food_retail', specialty:'متجر أغذية' },
  { key:'tourism', value:'hotel', groupId:'food_grocery', code:'hospitality_events', specialty:'فندق' },
  { key:'tourism', value:'guest_house', groupId:'food_grocery', code:'hospitality_events', specialty:'دار ضيافة' },
  { key:'tourism', value:'hostel', groupId:'food_grocery', code:'hospitality_events', specialty:'نزل' },
  { key:'tourism', value:'motel', groupId:'food_grocery', code:'hospitality_events', specialty:'فندق طريق' },
  { key:'shop', value:'clothes', groupId:'fashion_beauty', code:'clothing_stores', specialty:'ملابس وأزياء' },
  { key:'shop', value:'fashion', groupId:'fashion_beauty', code:'clothing_stores', specialty:'ملابس وأزياء' },
  { key:'shop', value:'shoes', groupId:'fashion_beauty', code:'shoes_bags', specialty:'أحذية' },
  { key:'shop', value:'bag', groupId:'fashion_beauty', code:'shoes_bags', specialty:'حقائب' },
  { key:'shop', value:'leather', groupId:'fashion_beauty', code:'shoes_bags', specialty:'منتجات جلدية' },
  { key:'shop', value:'cosmetics', groupId:'fashion_beauty', code:'beauty_products', specialty:'مستحضرات تجميل' },
  { key:'shop', value:'perfumery', groupId:'fashion_beauty', code:'beauty_products', specialty:'عطور' },
  { key:'shop', value:'hairdresser', groupId:'fashion_beauty', code:'salons', specialty:'صالون حلاقة وتجميل' },
  { key:'shop', value:'beauty', groupId:'fashion_beauty', code:'salons', specialty:'خدمات تجميل' },
  { key:'amenity', value:'school', groupId:'education_training', code:'schools', specialty:'مدرسة' },
  { key:'amenity', value:'college', groupId:'education_training', code:'schools', specialty:'مؤسسة تعليمية' },
  { key:'amenity', value:'university', groupId:'education_training', code:'schools', specialty:'جامعة' },
  { key:'amenity', value:'kindergarten', groupId:'education_training', code:'nurseries', specialty:'حضانة' },
  { key:'amenity', value:'childcare', groupId:'education_training', code:'nurseries', specialty:'رعاية أطفال' },
  { key:'amenity', value:'language_school', groupId:'education_training', code:'training_centers', specialty:'مركز لغات' },
  { key:'amenity', value:'music_school', groupId:'education_training', code:'training_centers', specialty:'مركز تدريب' },
  { key:'leisure', value:'fitness_centre', groupId:'education_training', code:'sports_centers', specialty:'مركز لياقة' },
  { key:'leisure', value:'sports_centre', groupId:'education_training', code:'sports_centers', specialty:'مركز رياضي' },
  { key:'shop', value:'furniture', groupId:'home_maintenance', code:'furniture', specialty:'أثاث ومفروشات' },
  { key:'shop', value:'kitchen', groupId:'home_maintenance', code:'furniture', specialty:'مطابخ وتجهيزات' },
  { key:'shop', value:'hardware', groupId:'home_maintenance', code:'building_supplies', specialty:'أدوات ومستلزمات بناء' },
  { key:'shop', value:'building_materials', groupId:'home_maintenance', code:'building_supplies', specialty:'مواد بناء' },
  { key:'shop', value:'paint', groupId:'home_maintenance', code:'building_supplies', specialty:'دهانات' },
  { key:'shop', value:'tiles', groupId:'home_maintenance', code:'building_supplies', specialty:'سيراميك وبلاط' },
  { key:'craft', value:'electrician', groupId:'home_maintenance', code:'home_services', specialty:'خدمات كهرباء' },
  { key:'craft', value:'plumber', groupId:'home_maintenance', code:'home_services', specialty:'خدمات سباكة' },
  { key:'craft', value:'locksmith', groupId:'home_maintenance', code:'home_services', specialty:'أقفال ومفاتيح' },
  { key:'craft', value:'appliance_repair', groupId:'home_maintenance', code:'home_services', specialty:'صيانة أجهزة منزلية' },
  { key:'craft', value:'carpenter', groupId:'agriculture_animals', code:'workshops', specialty:'نجارة' },
  { key:'craft', value:'blacksmith', groupId:'agriculture_animals', code:'workshops', specialty:'حدادة' },
  { key:'craft', value:'metal_construction', groupId:'agriculture_animals', code:'workshops', specialty:'تصنيع معدني' },
  { key:'craft', value:'shoemaker', groupId:'agriculture_animals', code:'workshops', specialty:'أحذية ومنتجات جلدية' },
  { key:'craft', value:'tailor', groupId:'agriculture_animals', code:'workshops', specialty:'خياطة وتفصيل' },
  { key:'shop', value:'car', groupId:'auto_transport', code:'car_showrooms', specialty:'معرض سيارات' },
  { key:'shop', value:'car_repair', groupId:'auto_transport', code:'auto_maintenance', specialty:'صيانة سيارات' },
  { key:'amenity', value:'car_repair', groupId:'auto_transport', code:'auto_maintenance', specialty:'صيانة سيارات' },
  { key:'shop', value:'car_parts', groupId:'auto_transport', code:'auto_parts', specialty:'قطع غيار سيارات' },
  { key:'shop', value:'tyres', groupId:'auto_transport', code:'auto_parts', specialty:'إطارات' },
  { key:'shop', value:'motorcycle', groupId:'auto_transport', code:'auto_parts', specialty:'مستلزمات دراجات نارية' },
  { key:'office', value:'lawyer', groupId:'professional_services', code:'legal_services', specialty:'خدمات قانونية' },
  { key:'office', value:'notary', groupId:'professional_services', code:'legal_services', specialty:'خدمات توثيق' },
  { key:'office', value:'accountant', groupId:'professional_services', code:'accounting_services', specialty:'خدمات محاسبية' },
  { key:'office', value:'tax_advisor', groupId:'professional_services', code:'accounting_services', specialty:'استشارات ضريبية' },
  { key:'office', value:'consulting', groupId:'professional_services', code:'business_consulting', specialty:'استشارات أعمال' },
  { key:'office', value:'insurance', groupId:'professional_services', code:'financial_services', specialty:'خدمات تأمين' },
  { key:'amenity', value:'bank', groupId:'professional_services', code:'financial_services', specialty:'خدمات مالية ومصرفية' },
  { key:'amenity', value:'bureau_de_change', groupId:'professional_services', code:'financial_services', specialty:'خدمات صرف عملات' },
  { key:'office', value:'it', groupId:'technology_communications', code:'software_companies', specialty:'خدمات تقنية وبرمجيات' },
  { key:'office', value:'software', groupId:'technology_communications', code:'software_companies', specialty:'برمجيات' },
  { key:'healthcare', value:'veterinary', groupId:'agriculture_animals', code:'veterinary', specialty:'خدمات بيطرية' },
  { key:'amenity', value:'veterinary', groupId:'agriculture_animals', code:'veterinary', specialty:'خدمات بيطرية' },
  { key:'shop', value:'agrarian', groupId:'agriculture_animals', code:'farms_agriculture', specialty:'مستلزمات زراعية' },
  { key:'shop', value:'farm', groupId:'agriculture_animals', code:'farms_agriculture', specialty:'منتجات ومستلزمات مزارع' },
];

const normalize = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('ar');
const validCoord = (lat, lon) =>
  Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

export function verifyMonufiaBoundary(elements) {
  const boundary = (elements || []).find((element) =>
    element?.type === 'relation' && Number(element.id) === MONUFIA_OSM_RELATION_ID
  );
  if (!boundary) throw new Error('The Overpass response does not include the expected Monufia administrative relation 3824207.');
  const tags = boundary.tags || {};
  const names = [tags.name, tags['name:ar'], tags['name:en'], tags.official_name]
    .map(normalize).filter(Boolean).join(' ');
  if (tags.boundary !== 'administrative' || !/(منوف|minuf|menou|monuf)/i.test(names)) {
    throw new Error('The expected OSM relation ID is present but its administrative boundary/name tags do not identify Monufia.');
  }
  return {
    id: MONUFIA_OSM_RELATION_ID,
    name: tags['name:ar'] || tags.name || tags['name:en'] || 'المنوفية',
    adminLevel: tags.admin_level || null,
    sourceUrl: 'https://www.openstreetmap.org/relation/' + MONUFIA_OSM_RELATION_ID,
  };
}

export function classifyOsmTags(tags = {}) {
  for (const rule of EXACT_RULES) {
    if (normalize(tags[rule.key]) === rule.value) {
      return {
        groupId: rule.groupId,
        code: rule.code,
        specialty: rule.specialty,
        sourceTagKey: rule.key,
        sourceTagValue: rule.value,
        taxonomyReviewRequired: false,
      };
    }
  }

  // Retain uncommon named shops in the existing general-retail category,
  // but flag them for human specialty review rather than inventing categories.
  const shop = normalize(tags.shop);
  if (shop && !['yes','vacant','no'].includes(shop)) {
    return {
      groupId: 'fashion_beauty',
      code: 'general_retail',
      specialty: null,
      sourceTagKey: 'shop',
      sourceTagValue: shop,
      taxonomyReviewRequired: true,
    };
  }

  // Unknown offices, crafts, healthcare, tourism and leisure tags must not be
  // forced into inaccurate taxonomy. They go to a separate review file.
  for (const key of ['office','craft','healthcare','tourism','leisure']) {
    const value = normalize(tags[key]);
    if (value) return {
      groupId: null,
      code: null,
      specialty: null,
      sourceTagKey: key,
      sourceTagValue: value,
      taxonomyReviewRequired: true,
    };
  }
  return null;
}

function readName(tags) {
  return String(tags['name:ar'] || tags.name || tags['name:en'] || '').trim();
}

function readCoordinates(element) {
  const lat = Number(element.lat ?? element.center?.lat);
  const lon = Number(element.lon ?? element.center?.lon);
  return validCoord(lat, lon) ? { latitude: lat, longitude: lon } : null;
}

function makeRecord(element, classification, snapshotAt) {
  const tags = element.tags || {};
  const coordinates = readCoordinates(element);
  const name = readName(tags);
  const externalRef = 'osm:' + element.type + ':' + String(element.id);
  return {
    source_id: externalRef,
    source_url: 'https://www.openstreetmap.org/' + element.type + '/' + String(element.id),
    source_name: 'OpenStreetMap',
    source_license: SOURCE_LICENSE,
    source_attribution: SOURCE_ATTRIBUTION,
    source_snapshot_at: snapshotAt,
    governorate: 'المنوفية',
    name,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    functional_group_id: classification.groupId,
    activity_category_id: classification.groupId && classification.code
      ? 'cat_' + classification.groupId + '_' + classification.code
      : null,
    activity_category_code: classification.code,
    specialty_suggestion: classification.specialty,
    source_tag_key: classification.sourceTagKey,
    source_tag_value: classification.sourceTagValue,
    taxonomy_review_required: classification.taxonomyReviewRequired,
    verification_status: 'UNVERIFIED',
    publication_status: 'DRAFT',
    claim_status: 'UNCLAIMED',
    contact_consent_status: 'NOT_REVIEWED',
    is_verified: false,
    public_enabled: false,
    publishable: false,
    requires_owner_confirmation: true,
  };
}

export function prepareMonufiaCandidates(overpassPayload, { snapshotAt = new Date().toISOString() } = {}) {
  const elements = overpassPayload?.elements;
  if (!Array.isArray(elements)) throw new Error('Invalid Overpass response: expected an elements array.');
  if (elements.length > MAX_INPUT_ELEMENTS) throw new Error('Overpass response exceeds the safe input cap of ' + MAX_INPUT_ELEMENTS + ' elements.');

  const boundary = verifyMonufiaBoundary(elements);
  const seen = new Set();
  const candidates = [];
  const needsReview = [];
  let ignored = 0;

  for (const element of elements) {
    if (!element || !['node','way','relation'].includes(element.type) || Number(element.id) === MONUFIA_OSM_RELATION_ID) {
      ignored += 1;
      continue;
    }
    const externalRef = 'osm:' + element.type + ':' + String(element.id ?? '');
    if (!element.id || seen.has(externalRef)) { ignored += 1; continue; }
    seen.add(externalRef);

    const tags = element.tags || {};
    if (!readName(tags)) { ignored += 1; continue; }
    const coordinates = readCoordinates(element);
    if (!coordinates) { ignored += 1; continue; }
    if (!COMMERCIAL_KEYS.some((key) => normalize(tags[key]))) { ignored += 1; continue; }

    const classification = classifyOsmTags(tags);
    if (!classification) { ignored += 1; continue; }

    const record = makeRecord(element, classification, snapshotAt);
    if (classification.groupId && classification.code) candidates.push(record);
    else needsReview.push(record);
    if (candidates.length + needsReview.length > MAX_OUTPUT_RECORDS) {
      throw new Error('Candidate output exceeds the safe cap of ' + MAX_OUTPUT_RECORDS + ' records.');
    }
  }

  const countsByCategory = {};
  const countsByGroup = {};
  for (const candidate of candidates) {
    countsByCategory[candidate.activity_category_id] = (countsByCategory[candidate.activity_category_id] || 0) + 1;
    countsByGroup[candidate.functional_group_id] = (countsByGroup[candidate.functional_group_id] || 0) + 1;
  }

  return {
    manifest: {
      schema_version: 1,
      generated_at: snapshotAt,
      source: 'OpenStreetMap',
      source_license: SOURCE_LICENSE,
      source_license_url: SOURCE_LICENSE_URL,
      source_attribution: SOURCE_ATTRIBUTION,
      source_attribution_url: 'https://www.openstreetmap.org/copyright',
      extraction_provider: 'Overpass API',
      extraction_api_url: 'https://overpass-api.de/api/interpreter',
      boundary,
      mapped_candidate_count: candidates.length,
      taxonomy_review_count: needsReview.length,
      ignored_element_count: ignored,
      contact_fields_excluded: true,
      unverified_by_default: true,
      production_write_performed: false,
      publication_enabled: false,
      license_scope: 'This OSM-derived candidate dataset only. It is kept separate from the proprietary MantiqatiX business database.',
      redistribution_notice: 'The OSM-derived database and modifications must be made available under ODbL 1.0 with attribution.',
      counts_by_category: countsByCategory,
      counts_by_group: countsByGroup,
    },
    candidates,
    needs_review: needsReview,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--snapshot-at') args.snapshotAt = argv[++i];
    else throw new Error('Unknown argument: ' + argv[i]);
  }
  if (!args.input || !args.output) throw new Error('Usage: node scripts/prepare-monufia-osm-candidates.mjs --input overpass.json --output output-dir [--snapshot-at ISO]');
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const input = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const result = prepareMonufiaCandidates(input, { snapshotAt: args.snapshotAt || new Date().toISOString() });
  fs.mkdirSync(args.output, { recursive: true });
  fs.writeFileSync(path.join(args.output, 'manifest.json'), JSON.stringify(result.manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(args.output, 'candidates.json'), JSON.stringify(result.candidates, null, 2) + '\n');
  fs.writeFileSync(path.join(args.output, 'needs-taxonomy-review.json'), JSON.stringify(result.needs_review, null, 2) + '\n');
  fs.writeFileSync(path.join(args.output, 'README.md'), [
    '# Monufia OpenStreetMap candidate extract',
    '',
    'Source: [OpenStreetMap](https://www.openstreetmap.org/) via the public Overpass API.',
    'Attribution: **© OpenStreetMap contributors** — [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).',
    '',
    'This OSM-derived dataset is licensed under ODbL 1.0. Any redistribution of this derived database must preserve ODbL 1.0 and attribution.',
    'It is intentionally separate from MantiqatiX proprietary business records.',
    '',
    'All records are UNVERIFIED, DRAFT, UNCLAIMED, and publishable=false. No phone, email, website, social profile, opening hours, or detailed street-address fields are exported.',
    'No Supabase, Production database, Edge Function, or public catalog write is performed by this workflow.',
    '',
    'See manifest.json for extraction timestamp, boundary relation, source license and counts.',
  ].join('\n') + '\n');
  console.log(JSON.stringify({
    status: 'PASS',
    mapped_candidate_count: result.candidates.length,
    taxonomy_review_count: result.needs_review.length,
    ignored_element_count: result.manifest.ignored_element_count,
    source_license: result.manifest.source_license,
    boundary_relation_id: result.manifest.boundary.id,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
