import assert from "node:assert/strict";
import test from "node:test";
import {
  filterPublicDirectoryListingsBySourceRights,
  isDoctorPublicListingAllowed,
  scanPublicDirectoryPageWithSourceRights,
} from "../../supabase/functions/directory-listings/doctor-publication-contract.mjs";

const NOW = new Date("2026-11-24T10:00:00.000Z");
const evidence = (overrides = {}) => ({
  status: "APPROVED",
  revoked_at: null,
  valid_from: "2026-10-01T00:00:00.000Z",
  expires_at: "2026-12-01T00:00:00.000Z",
  allows_doctor_profile_republication: true,
  allows_commercial_republication: true,
  source_host: "example.org",
  source_name: "Example Directory",
  ...overrides,
});
const doctor = (overrides = {}) => ({
  id: "doctor-1",
  listing_type: "doctor",
  listing_status: "PUBLISHED",
  claim_status: "UNCLAIMED",
  source_name: "Example Directory",
  source_url: "https://www.example.org/profile/1",
  created_at: "2026-11-24T09:00:00.000Z",
  ...overrides,
});
const business = (overrides = {}) => ({
  id: "business-1",
  listing_type: "business",
  listing_status: "PUBLISHED",
  source_name: "Public Business Listing",
  source_url: "https://business.example.net/profile/1",
  created_at: "2026-11-24T08:00:00.000Z",
  ...overrides,
});

test("requires a current exact-host and exact-source match with both republication scopes", () => {
  assert.equal(isDoctorPublicListingAllowed(doctor(), [evidence()], NOW), true);
  for (const rejected of [
    evidence({ status: "PENDING" }),
    evidence({ status: "REVOKED" }),
    evidence({ revoked_at: "2026-11-23T00:00:00.000Z" }),
    evidence({ valid_from: "2026-11-25T00:00:00.000Z" }),
    evidence({ expires_at: "2026-11-23T00:00:00.000Z" }),
    evidence({ source_host: "other.example" }),
    evidence({ source_name: "Other Directory" }),
    evidence({ allows_doctor_profile_republication: false }),
    evidence({ allows_commercial_republication: false }),
  ]) assert.equal(isDoctorPublicListingAllowed(doctor(), [rejected], NOW), false);
});

test("missing evidence, missing provenance and a registry error represented as no evidence fail closed", () => {
  assert.equal(isDoctorPublicListingAllowed(doctor(), [], NOW), false);
  assert.equal(isDoctorPublicListingAllowed(doctor({ source_name: "" }), [evidence()], NOW), false);
  assert.equal(isDoctorPublicListingAllowed(doctor({ source_url: "" }), [evidence()], NOW), false);
  assert.equal(isDoctorPublicListingAllowed(doctor(), null, NOW), false);
});

test("claiming or owning a doctor listing never bypasses source republication permission", () => {
  for (const claim_status of ["UNCLAIMED", "CLAIM_PENDING", "CLAIMED"]) {
    assert.equal(isDoctorPublicListingAllowed(doctor({ claim_status }), [], NOW), false);
  }
});

test("known non-doctor listing types retain their separately governed publication behavior", () => {
  for (const listing_type of ["business", "clinic", "pharmacy", "medical_center", "hospital", "laboratory", "health_provider"]) {
    assert.equal(isDoctorPublicListingAllowed(doctor({ listing_type }), [], NOW), true);
  }
});

test("unknown and missing listing types fail closed instead of bypassing the source-rights allowlist", () => {
  for (const listing_type of ["", "unknown", "provider", null, undefined]) {
    assert.equal(isDoctorPublicListingAllowed(doctor({ listing_type }), [evidence()], NOW), false);
  }
});

test("mixed listing filtering preserves order and retains only evidenced doctors", () => {
  const rows = [
    doctor({ id: "doctor-denied", source_name: "No Evidence" }),
    business({ id: "business-kept" }),
    doctor({ id: "doctor-allowed" }),
  ];
  const result = filterPublicDirectoryListingsBySourceRights(rows, [evidence()], NOW);
  assert.deepEqual(result.map((row) => row.id), ["business-kept", "doctor-allowed"]);
});

test("cursor scan fills a page beyond blocked doctor rows without skipping eligible records", async () => {
  const batches = [
    [
      doctor({ id: "blocked-1", source_name: "Other" }),
      business({ id: "business-1" }),
      doctor({ id: "blocked-2", source_name: "Other" }),
    ],
    [
      business({ id: "business-2", created_at: "2026-11-24T07:00:00.000Z" }),
      doctor({ id: "doctor-allowed-1", created_at: "2026-11-24T06:00:00.000Z" }),
      doctor({ id: "doctor-allowed-2", created_at: "2026-11-24T05:00:00.000Z" }),
    ],
  ];
  const cursors = [];
  const result = await scanPublicDirectoryPageWithSourceRights({
    fetchBatch: async (cursor, pageSize) => {
      cursors.push({ cursor, pageSize });
      return batches.shift() || [];
    },
    limit: 2,
    batchSize: 3,
    maxScanned: 6,
    evidenceRows: [evidence()],
    now: NOW,
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.listings.map((row) => row.id), ["business-1", "business-2"]);
  assert.equal(result.hasMore, true);
  assert.deepEqual(result.nextCursor, {
    created_at: "2026-11-24T07:00:00.000Z",
    id: "business-2",
  });
  assert.equal(cursors[1].cursor.id, "blocked-2");
});

test("scan limit fails closed rather than returning an incomplete page", async () => {
  const result = await scanPublicDirectoryPageWithSourceRights({
    fetchBatch: async (_cursor, pageSize) => Array.from({ length: pageSize }, (_, index) =>
      doctor({ id: "blocked-" + index, source_name: "No Evidence" })
    ),
    limit: 2,
    batchSize: 2,
    maxScanned: 2,
    evidenceRows: [],
    now: NOW,
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, "SCAN_LIMIT_REACHED");
  assert.deepEqual(result.listings, []);
});

test("database fetch failure fails closed", async () => {
  const result = await scanPublicDirectoryPageWithSourceRights({
    fetchBatch: async () => { throw new Error("database unavailable"); },
    limit: 2,
    batchSize: 2,
    maxScanned: 2,
    evidenceRows: [evidence()],
    now: NOW,
  });
  assert.equal(result.ready, false);
  assert.equal(result.reason, "READ_FAILED");
});
