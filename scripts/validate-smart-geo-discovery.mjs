import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const directoryPath = path.join(root, 'apps/catalog-frontend/src/components/DirectoryView.tsx');
const geoPath = path.join(root, 'apps/catalog-frontend/src/data/egyptGeoDiscovery.ts');
const directory = fs.readFileSync(directoryPath, 'utf8');
const geo = fs.readFileSync(geoPath, 'utf8');

function readExportedArray(source, exportName) {
  const pattern = new RegExp('export const ' + exportName + ': [^=]+ = (\\[[^\\n]+\\]);');
  const match = source.match(pattern);
  assert.ok(match, exportName + ' array must exist');
  return JSON.parse(match[1]);
}

const governorates = readExportedArray(geo, 'EGYPT_GEO_GOVERNORATES');
const districts = readExportedArray(geo, 'EGYPT_GEO_DISTRICTS');
const expectedGovernorateIds = new Set(governorates.map((item) => item.id));
const totalShiyakhas = districts.reduce((sum, district) => sum + district.shiyakhaCount, 0);

assert.equal(governorates.length, 27, 'All 27 Egyptian governorates must be available');
assert.equal(districts.length, 365, 'All 365 Egyptian district/center records must be available');
assert.equal(totalShiyakhas, 5716, 'The locality child-count total must match the source dataset');
assert.equal(new Set(governorates.map((item) => item.id)).size, governorates.length, 'Governorate IDs must be unique');
assert.equal(new Set(districts.map((item) => item.id)).size, districts.length, 'District IDs must be unique');
assert.ok(districts.every((district) => expectedGovernorateIds.has(district.governorateId)), 'Every district must reference a valid governorate');
assert.ok(districts.every((district) => district.slug && district.governorateSlug), 'Every district must have a source path');
assert.ok([...governorates, ...districts].every((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon)), 'Every representative point must be valid');

assert.ok(directory.includes('role="dialog"') && directory.includes('aria-modal="true"'), 'First-visit consent dialog is required');
assert.ok(directory.includes('السماح باستخدام موقعي'), 'Consent action must be explicit and visible');
assert.ok(directory.includes('navigator.geolocation.getCurrentPosition'), 'The browser location API must be used');
assert.ok(directory.includes("permission.state === 'granted'"), 'Silent location refresh is allowed only after prior browser grant');
assert.ok(directory.includes('onClick={requestUserLocation}') && directory.includes('السماح باستخدام موقعي'), 'Browser geolocation must be gated by the explicit in-page consent action');
assert.ok(!directory.includes('firstVisitGeoPromptStarted'), 'First-visit GPS must not be requested automatically before consent');
assert.ok(!directory.includes('watchPosition('), 'Continuous location tracking is forbidden');
assert.ok(directory.includes('mantiqatix.geo-discovery.v1'), 'The geographic preference key must be versioned');
assert.ok(directory.includes('Precise GPS coordinates stay in memory'), 'Precise coordinates must not be persisted');
assert.ok(directory.includes('writeStoredGeoPreference'), 'Administrative choices must persist');
assert.ok(directory.includes('normalizeAdministrativeName'), 'Administrative prefixes must normalize consistently');
assert.ok(directory.toLowerCase().includes('verified activities always lead'), 'Verified activities must retain ranking priority');
assert.ok(directory.includes('مصر بالكامل — كل المحافظات'), 'Egypt-wide scope must be directly selectable');
assert.ok(directory.includes('EGYPT_GEO_DISTRICTS') && directory.includes('EGYPT_GEO_GOVERNORATES'), 'Manual selectors must use the full national hierarchy');
assert.ok(directory.includes('administrativeShiyakhas.map'), 'Manual village/shiyakha options must use child locality data');
assert.ok(directory.includes('listing.district'), 'Manual geographic scope must apply to unclaimed directory listings');
assert.ok(directory.includes('biz.markaz'), 'Manual geographic scope must apply to registered activities');
assert.ok(directory.includes('match.district?.name'), 'Governorate-only fallback must not dereference a missing district');
assert.ok(directory.includes('21.5 || latitude > 32.2'), 'GPS outside the supported Egypt extent must be rejected for local ranking');
assert.ok(directory.includes('{locationWelcomeDialog}'), 'First-visit consent must also render on alternate directory routes');

assert.ok(geo.includes('EGYPT_GEO_DATASET') && geo.includes("license: 'CC-BY-4.0'"), 'Dataset attribution and license must be preserved');
assert.ok(geo.includes('2026-09-08'), 'Dataset reference date must be preserved');
assert.ok(geo.includes('raw.githubusercontent.com/open-admin-data/egypt-administrative-divisions'), 'District locality source path must be versioned and attributable');
assert.ok(geo.includes("credentials: 'omit'") && geo.includes("referrerPolicy: 'no-referrer'"), 'Third-party locality requests must omit credentials and referrer');
assert.ok(geo.includes('district.governorateSlug') && geo.includes('district.slug'), 'Locality fetches must use public district identifiers only');
assert.ok(geo.includes('AbortController') && geo.includes('8000'), 'Locality requests must have a bounded timeout');
assert.ok(geo.includes('latitude < 21.5') && geo.includes('longitude < 24'), 'Resolver must reject coordinates outside Egypt bounds');
assert.ok(geo.includes('.slice(0, 5)'), 'Resolver must limit locality lookups to nearest candidate districts');
assert.ok(geo.includes('nearestShiyakha.distanceKm <= 8'), 'Shiyakha suggestion must have an explicit maximum distance');
assert.ok(geo.includes('nearestDistrict.distanceKm > 35'), 'District suggestion must have an explicit maximum distance');
assert.ok(geo.includes('not point-in-polygon proof'), 'Nearest representative points must not be presented as legal boundaries');

const birkat = districts.find((district) => district.id === 'EG1706');
assert.ok(birkat, 'Birkat Al-Sab must exist in the Menoufia selector');
assert.equal(birkat.name, 'مركز بركة السبع');
assert.equal(birkat.governorateId, 'EG17');
assert.equal(birkat.shiyakhaCount, 22);

console.log('SMART_GEO_DISCOVERY_CONTRACT=PASS');
console.log('EGYPT_GOVERNORATES=' + governorates.length + '; DISTRICTS=' + districts.length + '; SHIYAKHAS=' + totalShiyakhas);
console.log('GPS_COORDINATES_PERSISTED=NO; GPS_SENT_TO_ADMIN_DATA_SOURCE=NO; CONTINUOUS_TRACKING=NO');
console.log('BIRKAT_AL_SAB=PASS; DATA_LICENSE=CC-BY-4.0; DATA_VERSION=2026.09');
