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

test("false and truthy-but-not-exact flags do not enable public discovery", () => {
  for (const flag of [false, "false", "TRUE", "1", "yes", 1, {}]) {
    const result = resolveDirectoryListingsReleaseGate("GET", flag, true);
    assert.equal(result.body.directoryDisabled, true, String(flag));
  }
});

test("public discovery is enabled by the exact flag even when consent registry is absent", () => {
  assert.equal(resolveDirectoryListingsReleaseGate("GET", "true", false), null);
});

test("public discovery remains disabled until the exact server-side flag is enabled", () => {
  const result = resolveDirectoryListingsReleaseGate("GET", undefined, false);
  assert.equal(result.body.directoryDisabled, true);
});

test("claims and contact-consent writes remain blocked when the consent registry is absent", () => {
  const result = resolveDirectoryListingsReleaseGate("POST", "true", false);
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "DIRECTORY_LISTINGS_DISABLED_FOR_V1");
});

test("claims and contact-consent writes require exact enablement and a reachable registry", () => {
  assert.equal(resolveDirectoryListingsReleaseGate("POST", "true", true), null);
  for (const flag of [undefined, false, "TRUE", "1"]) {
    assert.equal(resolveDirectoryListingsReleaseGate("POST", flag, true).status, 503);
  }
});

test("OPTIONS remains available for CORS preflight while the feature is disabled", () => {
  assert.equal(resolveDirectoryListingsReleaseGate("OPTIONS", undefined, false), null);
});

test("unsupported methods are rejected regardless of release state", () => {
  for (const flag of [undefined, "true"]) {
    const result = resolveDirectoryListingsReleaseGate("DELETE", flag, true);
    assert.equal(result.status, 405);
    assert.equal(result.body.error, "METHOD_NOT_ALLOWED");
  }
});
