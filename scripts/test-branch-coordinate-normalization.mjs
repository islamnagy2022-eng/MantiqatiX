import test from "node:test";
import assert from "node:assert/strict";
import { parseOptionalCoordinate, parseBranchCoordinates } from "../supabase/functions/_shared/branch-coordinates.mjs";

test("missing and blank coordinates are treated as absent, not zero", () => {
  assert.equal(parseOptionalCoordinate(undefined), null);
  assert.equal(parseOptionalCoordinate(null), null);
  assert.equal(parseOptionalCoordinate(""), null);
  assert.equal(parseOptionalCoordinate("   "), null);
});

test("valid numeric values and numeric strings are preserved", () => {
  assert.equal(parseOptionalCoordinate(0), 0);
  assert.equal(parseOptionalCoordinate("-90"), -90);
  assert.equal(parseOptionalCoordinate("180"), 180);
  assert.equal(parseOptionalCoordinate("  31.2 "), 31.2);
});

test("invalid numbers and unsupported JSON types fail closed", () => {
  for (const value of ["north", "NaN", "Infinity", true, false, {}, [], ["30"], Number.NaN, Infinity, -Infinity]) {
    assert.equal(Number.isNaN(parseOptionalCoordinate(value)), true, `expected invalid coordinate: ${String(value)}`);
  }
});

test("both coordinates may be absent, but partial coordinate pairs are rejected", () => {
  assert.deepEqual(parseBranchCoordinates(undefined, undefined), { latitude: null, longitude: null, error: null });
  assert.equal(parseBranchCoordinates("30", null).error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates(null, "31").error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates(" ", "").error, null);
});

test("latitude and longitude inclusive limits are accepted", () => {
  assert.equal(parseBranchCoordinates(-90, -180).error, null);
  assert.equal(parseBranchCoordinates(90, 180).error, null);
  assert.equal(parseBranchCoordinates("30.0444", "31.2357").error, null);
});

test("coordinates outside legal ranges are rejected", () => {
  assert.equal(parseBranchCoordinates(-90.0001, 0).error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates(90.0001, 0).error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates(0, -180.0001).error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates(0, 180.0001).error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates("north", "31").error, "INVALID_COORDINATES");
  assert.equal(parseBranchCoordinates(true, false).error, "INVALID_COORDINATES");
});
