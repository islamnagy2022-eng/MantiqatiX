#!/usr/bin/env node
/**
 * Structural release gate for Egypt administrative boundary GeoJSON.
 *
 * This deliberately does not claim topological validity. Before production use,
 * run a GIS validity/overlap/gap audit and an audited P-code crosswalk as well.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';

function fail(message) {
  throw new Error(message);
}

function finitePosition(position) {
  return Array.isArray(position)
    && position.length >= 2
    && Number.isFinite(position[0])
    && Number.isFinite(position[1])
    && position[0] >= -180 && position[0] <= 180
    && position[1] >= -90 && position[1] <= 90;
}

function validateRing(ring, label, stats) {
  if (!Array.isArray(ring) || ring.length < 4) fail(label + ': ring must contain at least four positions');
  for (const position of ring) {
    if (!finitePosition(position)) fail(label + ': invalid WGS84 coordinate position');
    stats.positions += 1;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) fail(label + ': ring is not closed');
}

function validatePolygonCoordinates(coordinates, label, stats) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) fail(label + ': polygon has no rings');
  coordinates.forEach((ring, index) => validateRing(ring, label + '/ring-' + index, stats));
}

export function validateDataset(data, options = {}) {
  const expectedFeatures = options.expectedFeatures ?? 365;
  const idField = options.idField ?? 'shapeID';
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    fail('Expected a GeoJSON FeatureCollection');
  }
  if (data.crs && JSON.stringify(data.crs).toLowerCase().includes('3857')) {
    fail('Projected CRS detected; convert to WGS84 before release');
  }
  if (data.features.length !== expectedFeatures) {
    fail('Expected ' + expectedFeatures + ' features, received ' + data.features.length);
  }

  const ids = new Set();
  const stats = { features: data.features.length, polygons: 0, multipolygons: 0, positions: 0 };
  data.features.forEach((feature, index) => {
    const label = 'feature-' + index;
    if (!feature || feature.type !== 'Feature' || !feature.geometry) fail(label + ': malformed GeoJSON feature');
    const id = feature.properties?.[idField] ?? feature.id;
    if (id === undefined || id === null || String(id).trim() === '') {
      fail(label + ': missing stable identifier (' + idField + ' or feature.id)');
    }
    const key = String(id);
    if (ids.has(key)) fail(label + ': duplicate stable identifier ' + key);
    ids.add(key);

    if (feature.geometry.type === 'Polygon') {
      stats.polygons += 1;
      validatePolygonCoordinates(feature.geometry.coordinates, label, stats);
    } else if (feature.geometry.type === 'MultiPolygon') {
      stats.multipolygons += 1;
      if (!Array.isArray(feature.geometry.coordinates) || feature.geometry.coordinates.length === 0) {
        fail(label + ': multipolygon has no polygon parts');
      }
      feature.geometry.coordinates.forEach((polygon, part) => {
        validatePolygonCoordinates(polygon, label + '/part-' + part, stats);
      });
    } else {
      fail(label + ': unsupported geometry type ' + feature.geometry.type);
    }
  });

  return { ...stats, uniqueIds: ids.size, structuralStatus: 'PASS', topologyStatus: 'NOT_CHECKED', crosswalkStatus: 'NOT_CHECKED' };
}

function selfTest() {
  const square = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { shapeID: 'EGY-TEST-001' },
      geometry: { type: 'Polygon', coordinates: [[[30, 29], [31, 29], [31, 30], [30, 30], [30, 29]]] },
    }],
  };
  const multi = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'EGY-TEST-002',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [[[[30, 29], [31, 29], [31, 30], [30, 30], [30, 29]]]] },
    }],
  };
  assert.equal(validateDataset(square, { expectedFeatures: 1 }).uniqueIds, 1);
  assert.equal(validateDataset(multi, { expectedFeatures: 1 }).multipolygons, 1);
  assert.throws(() => validateDataset({ ...square, features: [] }, { expectedFeatures: 1 }), /Expected 1 features/);
  assert.throws(() => validateDataset({ ...square, features: [{ ...square.features[0], geometry: { type: 'Point', coordinates: [30, 29] } }] }, { expectedFeatures: 1 }), /unsupported geometry/);
  assert.throws(() => validateDataset({ ...square, features: [{ ...square.features[0], geometry: { type: 'Polygon', coordinates: [[[30, 29], [31, 29], [31, 30], [30, 30]]] } }] }, { expectedFeatures: 1 }), /not closed/);
  assert.throws(() => validateDataset({ ...square, features: [{ ...square.features[0], geometry: { type: 'Polygon', coordinates: [[[181, 29], [31, 29], [31, 30], [181, 29]]] } }] }, { expectedFeatures: 1 }), /invalid WGS84/);
  assert.throws(() => validateDataset({ ...square, features: [square.features[0], square.features[0]] }, { expectedFeatures: 2 }), /duplicate stable identifier/);
  console.log('EGYPT_GEO_BOUNDARY_STRUCTURAL_VALIDATOR_SELF_TEST=PASS');
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const fileIndex = process.argv.indexOf('--file');
  if (fileIndex < 0 || !process.argv[fileIndex + 1]) {
    console.error('Usage: node scripts/validate-egypt-geo-boundaries.mjs --file <geojson> [--expected-features 365] [--id-field shapeID]');
    process.exitCode = 2;
    return;
  }
  const expectedIndex = process.argv.indexOf('--expected-features');
  const idIndex = process.argv.indexOf('--id-field');
  const expectedFeatures = expectedIndex >= 0 ? Number(process.argv[expectedIndex + 1]) : 365;
  const idField = idIndex >= 0 ? process.argv[idIndex + 1] : 'shapeID';
  const data = JSON.parse(fs.readFileSync(process.argv[fileIndex + 1], 'utf8'));
  const result = validateDataset(data, { expectedFeatures, idField });
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error('EGYPT_GEO_BOUNDARY_VALIDATION=FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
