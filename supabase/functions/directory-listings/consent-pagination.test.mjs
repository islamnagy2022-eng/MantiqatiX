import test from "node:test";
import assert from "node:assert/strict";
import { collectActiveAddressConsentIds } from "./consent-pagination.mjs";

test("collects every consent ID when the API silently caps pages below requested size", async () => {
  const source = [
    { listing_id: "a" },
    { listing_id: "b" },
    { listing_id: "b" },
    { listing_id: "c" },
    { listing_id: "" },
  ];
  const calls = [];
  const result = await collectActiveAddressConsentIds(async (offset, pageSize) => {
    calls.push({ offset, pageSize });
    // Simulate a server max_rows cap of two rows, even when more were requested.
    return { data: source.slice(offset, offset + Math.min(pageSize, 2)), error: null };
  }, 1000);
  assert.deepEqual(result, { ids: ["a", "b", "c"], ready: true });
  assert.deepEqual(calls.map((call) => call.offset), [0, 2, 4, 5]);
});

test("returns an empty, not-ready result when any page fails", async () => {
  let call = 0;
  const result = await collectActiveAddressConsentIds(async () => {
    call += 1;
    if (call === 1) return { data: [{ listing_id: "a" }], error: null };
    return { data: null, error: new Error("consent table unavailable") };
  }, 100);
  assert.deepEqual(result, { ids: [], ready: false });
});

test("returns an empty ready result for an empty consent registry", async () => {
  const result = await collectActiveAddressConsentIds(async () => ({ data: [], error: null }));
  assert.deepEqual(result, { ids: [], ready: true });
});

test("fails closed when a page response is not an array", async () => {
  const result = await collectActiveAddressConsentIds(async () => ({ data: { listing_id: "a" }, error: null }));
  assert.deepEqual(result, { ids: [], ready: false });
});
