import test from "node:test";
import assert from "node:assert/strict";
import { parseBearerToken } from "../supabase/functions/_shared/bearer-token.mjs";

test("accepts a non-empty bearer token with case-insensitive scheme", () => {
  assert.equal(parseBearerToken("Bearer abc.def_123-~+/=="), "abc.def_123-~+/==");
  assert.equal(parseBearerToken("bearer abc.def"), "abc.def");
  assert.equal(parseBearerToken("BEARER abc.def"), "abc.def");
  assert.equal(parseBearerToken("  Bearer abc.def  "), "abc.def");
});

test("rejects missing, empty, malformed, or multi-token authorization values", () => {
  for (const value of [
    undefined, null, "", "Basic abc", "Bearer", "Bearer ", "Bearer    ",
    "Bearer abc def", "Bearer abc\nInjected: value", "Bearer abc,def", 42, {},
  ]) {
    assert.equal(parseBearerToken(value), null, String(value));
  }
});
