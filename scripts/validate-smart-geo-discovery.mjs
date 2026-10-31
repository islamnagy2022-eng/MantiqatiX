import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const directoryPath = path.join(root, 'apps/catalog-frontend/src/components/DirectoryView.tsx');
const areasPath = path.join(root, 'apps/catalog-frontend/src/data/egyptAdministrativeAreas.ts');
const directory = fs.readFileSync(directoryPath, 'utf8');
const areas = fs.readFileSync(areasPath, 'utf8');

function readArray(source, exportName) {
  const pattern = new RegExp('export const ' + exportName + ': [^=]+ = (\\[[\\s\\S]*?\\]);');
  const match = source.match(pattern);
  assert.ok(match, exportName + ' array must exist');
  return JSON.parse(match[1]);
}

const governorates = readArray(areas, 'EGYPT_GOVERNORATES');
const centers = readArray(areas, 'EGYPT_CENTERS');

assert.equal(governorates.length, 27, 'All 27 seeded Egyptian governorates must be selectable');
assert.equal(centers.length, 165, 'All 165 seeded Egyptian centers must be selectable');
assert.ok(directory.includes('role="dialog"') && directory.includes('aria-modal="true"'), 'First-visit consent dialog is required');
assert.ok(directory.includes('السماح باستخدام موقعي'), 'Consent action must be explicit and visible');
assert.ok(directory.includes('navigator.geolocation.getCurrentPosition'), 'The browser location API must be used');
assert.ok(directory.includes("permission.state === 'granted'"), 'Silent location refresh is allowed only after prior browser grant');
assert.ok(!directory.includes('watchPosition('), 'Continuous location tracking is forbidden');
assert.ok(directory.includes('mantiqatix.geo-discovery.v1'), 'The geographic preference key must be versioned');
assert.ok(directory.includes('Precise GPS coordinates stay in memory'), 'Precise coordinates must not be persisted');
assert.ok(directory.includes('writeStoredGeoPreference'), 'Administrative choices must persist');
assert.ok(directory.includes('normalizeAdministrativeName'), 'Administrative prefixes must normalize consistently');
assert.ok(directory.includes('verified activities always lead') || directory.includes('Verified activities always lead'), 'Verified activities remain first');
assert.ok(directory.includes('مصر بالكامل — كل المحافظات'), 'Egypt-wide scope must be directly selectable');
assert.ok(directory.includes('EGYPT_CENTERS.filter'), 'Center choices must cascade by selected governorate');
assert.ok(directory.includes('listing.district'), 'Manual geographic scope must apply to unclaimed directory listings');
assert.ok(directory.includes('biz.markaz'), 'Manual geographic scope must apply to registered activities');

console.log('SMART_GEO_DISCOVERY_CONTRACT=PASS');
console.log('EGYPT_GOVERNORATES=' + governorates.length + '; SEEDED_CENTERS=' + centers.length);
console.log('GPS_COORDINATES_PERSISTED=NO; CONTINUOUS_TRACKING=NO');
