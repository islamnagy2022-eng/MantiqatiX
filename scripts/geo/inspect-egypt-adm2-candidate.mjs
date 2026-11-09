#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const EXPECTED = {
  geoJsonSha256: "abd2e419ce95e1cdd46bb18025a4eccfa6f877956494a56da3ebed4bc6a153d9",
  geoJsonBytes: 1379010,
  districtCount: 365,
  sourceCommit: "9469f09592ced973a3448cf66b6100b741b64c0d",
  openAdminDataCommit: "76b47b22872288c0d8b0c757975980e6986945e8",
};

const GEOJSON_URL =
  "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/" +
  EXPECTED.sourceCommit +
  "/releaseData/gbOpen/EGY/ADM2/geoBoundaries-EGY-ADM2_simplified.geojson";
const DISTRICTS_URL =
  "https://raw.githubusercontent.com/open-admin-data/egypt-administrative-divisions/" +
  EXPECTED.openAdminDataCommit +
  "/data/all-district.json";

async function fetchBytes(url, label) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(90000),
    headers: { accept: "application/geo+json, application/json, application/octet-stream, */*" },
  });
  if (!response.ok) {
    throw new Error(label + " download failed: HTTP " + response.status + " " + response.statusText);
  }
  return Buffer.from(await response.arrayBuffer());
}

function readPositions(coords, featureIndex, stats) {
  if (!Array.isArray(coords)) throw new Error("Feature " + featureIndex + " has non-array coordinates");
  if (
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    const [lon, lat] = coords;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new Error("Feature " + featureIndex + " has non-finite coordinate");
    }
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new Error("Feature " + featureIndex + " has coordinate outside WGS84 bounds");
    }
    stats.positions += 1;
    return;
  }
  for (const child of coords) readPositions(child, featureIndex, stats);
}

function validateLinearRing(ring, featureIndex, polygonIndex, ringIndex, stats) {
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new Error("Invalid ring length: feature=" + featureIndex + " polygon=" + polygonIndex + " ring=" + ringIndex);
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    !Array.isArray(first) || !Array.isArray(last) ||
    first.length < 2 || last.length < 2 ||
    first[0] !== last[0] || first[1] !== last[1]
  ) {
    throw new Error("Unclosed ring: feature=" + featureIndex + " polygon=" + polygonIndex + " ring=" + ringIndex);
  }
  readPositions(ring, featureIndex, stats);
  stats.rings += 1;
}

function validateFeature(feature, index, stats) {
  assert.equal(feature?.type, "Feature", "GeoJSON feature " + index + " is invalid");
  const geometry = feature.geometry;
  assert.ok(geometry && typeof geometry === "object", "Missing geometry on feature " + index);
  assert.ok(
    geometry.type === "Polygon" || geometry.type === "MultiPolygon",
    "Unexpected geometry type on feature " + index + ": " + geometry.type
  );

  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  assert.ok(Array.isArray(polygons) && polygons.length > 0, "Feature " + index + " has empty polygons");
  for (let polygonIndex = 0; polygonIndex < polygons.length; polygonIndex += 1) {
    const rings = polygons[polygonIndex];
    assert.ok(Array.isArray(rings) && rings.length > 0, "Feature " + index + " has empty polygon rings");
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
      validateLinearRing(rings[ringIndex], index, polygonIndex, ringIndex, stats);
    }
    stats.polygons += 1;
  }
  stats.features += 1;
}

async function main() {
  console.log("GEO_BOUNDARY_SOURCE_COMMIT=" + EXPECTED.sourceCommit);
  console.log("OPEN_ADMIN_DATA_SOURCE_COMMIT=" + EXPECTED.openAdminDataCommit);

  const [geometryBytes, districtBytes] = await Promise.all([
    fetchBytes(GEOJSON_URL, "geoBoundaries ADM2 simplified GeoJSON"),
    fetchBytes(DISTRICTS_URL, "Open Admin Data district reference"),
  ]);

  assert.equal(geometryBytes.length, EXPECTED.geoJsonBytes, "Pinned GeoJSON byte size mismatch");
  const digest = createHash("sha256").update(geometryBytes).digest("hex");
  assert.equal(digest, EXPECTED.geoJsonSha256, "Pinned GeoJSON SHA-256 mismatch");
  console.log("GEO_BOUNDARY_LFS_SHA256=PASS " + digest);
  console.log("GEO_BOUNDARY_FILE_SIZE=PASS " + geometryBytes.length);

  const geo = JSON.parse(geometryBytes.toString("utf8"));
  assert.equal(geo.type, "FeatureCollection", "Expected a GeoJSON FeatureCollection");
  assert.ok(Array.isArray(geo.features), "GeoJSON features array is missing");
  assert.equal(geo.features.length, EXPECTED.districtCount, "ADM2 feature count mismatch");

  const geometryStats = { features: 0, polygons: 0, rings: 0, positions: 0 };
  for (let i = 0; i < geo.features.length; i += 1) {
    validateFeature(geo.features[i], i, geometryStats);
  }
  console.log("GEO_BOUNDARY_GEOJSON_STRUCTURE=PASS " + JSON.stringify(geometryStats));

  const propertyKeys = [...new Set(geo.features.flatMap((feature) =>
    Object.keys(feature.properties ?? {})
  ))].sort();
  console.log("GEO_BOUNDARY_PROPERTY_KEYS=" + JSON.stringify(propertyKeys));
  console.log("GEO_BOUNDARY_PROPERTY_SAMPLE=" + JSON.stringify(geo.features.slice(0, 3).map((feature) => feature.properties ?? {})));

  const districts = JSON.parse(districtBytes.toString("utf8"));
  assert.equal(districts.length, EXPECTED.districtCount, "Open Admin Data district count mismatch");
  const ids = districts.map((row) => row.id);
  assert.equal(new Set(ids).size, EXPECTED.districtCount, "Open Admin Data district IDs are not unique");
  assert.ok(districts.every((row) =>
    row.level === 2 &&
    row.code?.id === row.id &&
    /^EG[0-9]+$/.test(row.id) &&
    typeof row.parent?.id === "string" &&
    row.id.startsWith(row.parent.id) &&
    Number.isFinite(Number(row.geo?.lat)) &&
    Number.isFinite(Number(row.geo?.lon))
  ), "Open Admin Data district code/parent/coordinate contract failed");

  console.log("OPEN_ADMIN_DATA_DISTRICTS=PASS count=" + districts.length + " unique_ids=" + new Set(ids).size);

  const pcodeKey = propertyKeys.find((key) =>
    /^(adm2_pcode|adm2-pcode|pcode|p_code)$/i.test(key)
  );
  if (!pcodeKey) {
    console.log("ADM2_PCODE_CROSSWALK=NOT_VERIFIED no explicit ADM2 P-code property in pinned geoJSON");
  } else {
    const boundaryCodes = geo.features.map((feature) => String(feature.properties?.[pcodeKey] ?? ""));
    assert.ok(boundaryCodes.every(Boolean), "Boundary P-code property contains empty values");
    assert.equal(new Set(boundaryCodes).size, EXPECTED.districtCount, "Boundary P-codes are not unique");
    const openAdminCodes = new Set(districts.map((row) => row.code.id));
    const matched = boundaryCodes.filter((code) => openAdminCodes.has(code)).length;
    console.log("ADM2_PCODE_CROSSWALK=" + (matched === EXPECTED.districtCount ? "PASS" : "MISMATCH") +
      " matched=" + matched + "/" + EXPECTED.districtCount + " property=" + pcodeKey);
    if (matched !== EXPECTED.districtCount) {
      console.log("ADM2_PCODE_CROSSWALK_SAMPLE=" + JSON.stringify(boundaryCodes.slice(0, 10)));
    }
  }

  console.log("GEO_BOUNDARY_CANDIDATE_REVIEW=PASS");
  console.log("LIMITATION: structural checks do not prove topological validity, legal boundary currency, or ADM3 completeness.");
}

main().catch((error) => {
  console.error("GEO_BOUNDARY_CANDIDATE_REVIEW=FAIL");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
