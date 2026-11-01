import assert from "node:assert/strict";
import test from "node:test";
import {
  isCurrentDoctorRepublicationEvidence,
  normalizeDirectorySourceHost,
  resolveDoctorImportStatus,
  sanitizeDoctorImportMetadata,
} from "../../supabase/functions/directory-listings/doctor-import-contract.mjs";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const validEvidence = (overrides = {}) => ({
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

test("normalizes hostnames and strips a leading www", () => {
  assert.equal(normalizeDirectorySourceHost("WWW.Example.ORG"), "example.org");
  assert.equal(normalizeDirectorySourceHost("https://www.example.org"), "example.org");
  assert.equal(normalizeDirectorySourceHost(""), "");
});

test("rejects ambiguous source hosts with credentials, ports, paths or query strings", () => {
  for (const value of ["example.org/path", "example.org:8443", "https://user@example.org", "example.org?redirect=other", "https://example.org/#fragment"]) {
    assert.equal(normalizeDirectorySourceHost(value), "", value);
  }
});

test("accepts only current approved evidence for the exact source and both scopes", () => {
  assert.equal(isCurrentDoctorRepublicationEvidence(validEvidence(), "https://www.example.org/doctor/12", "example directory", NOW), true);
});

test("rejects pending, revoked, expired, not-yet-valid, wrong-host and wrong-source evidence", () => {
  const rejected = [
    validEvidence({ status: "PENDING" }),
    validEvidence({ revoked_at: "2026-10-31T00:00:00.000Z" }),
    validEvidence({ expires_at: "2026-10-31T00:00:00.000Z" }),
    validEvidence({ valid_from: "2026-11-02T00:00:00.000Z" }),
    validEvidence({ source_host: "another.example" }),
    validEvidence({ source_name: "Another Directory" }),
    validEvidence({ allows_doctor_profile_republication: false }),
    validEvidence({ allows_commercial_republication: false }),
  ];
  for (const evidence of rejected) assert.equal(
    isCurrentDoctorRepublicationEvidence(evidence, "https://example.org/doctor/12", "Example Directory", NOW), false,
  );
  assert.equal(isCurrentDoctorRepublicationEvidence(validEvidence(), "ftp://example.org/file", "Example Directory", NOW), false);
});

test("defaults missing phone status to DRAFT but rejects explicit publication without a phone", () => {
  assert.deepEqual(resolveDoctorImportStatus({}, false), {
    valid: true, reason: null, hasRequestedStatus: false, requestedStatus: "PUBLISHED", listingStatus: "DRAFT",
  });
  assert.equal(resolveDoctorImportStatus({ listingStatus: "PUBLISHED" }, false).reason, "PHONE_REQUIRED_FOR_PUBLICATION");
  assert.equal(resolveDoctorImportStatus({}, true).listingStatus, "PUBLISHED");
});

test("preserves an explicit HIDDEN or DRAFT state even without a phone", () => {
  assert.equal(resolveDoctorImportStatus({ listingStatus: "HIDDEN" }, false).listingStatus, "HIDDEN");
  assert.equal(resolveDoctorImportStatus({ listing_status: "DRAFT" }, false).listingStatus, "DRAFT");
  assert.equal(resolveDoctorImportStatus({ listingStatus: "UNKNOWN" }, true).reason, "INVALID_LISTING_STATUS");
});

test("strips untrusted verification flags while retaining ordinary metadata", () => {
  assert.deepEqual(sanitizeDoctorImportMetadata({
    bio: "Consultant", websiteUrl: "https://example.org",
    source_phone_verified: true, owner_confirmed: true,
    professional_registration_verified: true, coordinates_status: "VERIFIED", isVerified: true,
  }), { bio: "Consultant", websiteUrl: "https://example.org" });
  assert.deepEqual(sanitizeDoctorImportMetadata(null), {});
});
