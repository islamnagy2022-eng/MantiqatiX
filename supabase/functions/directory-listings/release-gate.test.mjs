import assert from "node:assert/strict";
import test from "node:test";
import { resolveDirectoryListingsReleaseGate } from "./release-gate.mjs";

test("missing server flag keeps public GET disabled and returns an empty contract", () => {
  const result = resolveDirectoryListingsReleaseGate("GET", undefined, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    listings: [],
    pageSize: 0,
    hasMore: false,
    nextCursor: null,
    directoryDisabled: true,
  });
});

test("false and truthy-but-not-exact flags do not enable the directory", () => {
  for (const flag of [false, "false", "TRUE", "1", "yes", 1, {}]) {
    const result = resolveDirectoryListingsReleaseGate("GET", flag, true);
    assert.equal(result.body.directoryDisabled, true, String(flag));
  }
});

test("an enabled flag is not sufficient when the consent registry is absent", () => {
  const result = resolveDirectoryListingsReleaseGate("GET", "true", false);
  assert.equal(result.status, 200);
  assert.equal(result.body.directoryDisabled, true);
  assert.deepEqual(result.body.listings, []);
});

test("public writes remain unavailable until both release conditions pass", () => {
  const result = resolveDirectoryListingsReleaseGate("POST", "true", false);
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "DIRECTORY_LISTINGS_DISABLED_FOR_V1");
});

test("exact enablement plus a reachable consent registry allows GET and POST through", () => {
  assert.equal(resolveDirectoryListingsReleaseGate("GET", "true", true), null);
  assert.equal(resolveDirectoryListingsReleaseGate("POST", "true", true), null);
});

test("OPTIONS remains available for CORS preflight while the feature is disabled", () => {
  assert.equal(resolveDirectoryListingsReleaseGate("OPTIONS", undefined, false), null);
});

test("unsupported methods are rejected when the feature is disabled", () => {
  const result = resolveDirectoryListingsReleaseGate("PUT", undefined, false);
  assert.equal(result.status, 405);
  assert.equal(result.body.error, "METHOD_NOT_ALLOWED");
});

test("unsupported methods are rejected even after the feature has been enabled", () => {
  const result = resolveDirectoryListingsReleaseGate("DELETE", "true", true);
  assert.equal(result.status, 405);
  assert.equal(result.body.error, "METHOD_NOT_ALLOWED");
});
