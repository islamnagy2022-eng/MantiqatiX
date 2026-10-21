import test from "node:test";
import assert from "node:assert/strict";
import { parseOptionalCoordinate } from "../supabase/functions/_shared/branch-coordinates.mjs";

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
